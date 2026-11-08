#requires -Version 5.1
[CmdletBinding()]
param([string]$LeaguePath, [switch]$Diagnose, [switch]$NoPause)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'
$script:InstallerFile = $PSCommandPath
$script:LogFile = $null
$script:IfeoKey = 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\LeagueClientUx.exe'

function Write-Step([string]$Text) {
    Write-Host $Text
    if ($script:LogFile) { Add-Content -LiteralPath $script:LogFile -Value $Text -Encoding UTF8 }
}

function Get-FullPath([string]$Path) {
    [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($Path.Trim().Trim('"'))).TrimEnd('\', '/')
}

function Test-Within([string]$Path, [string]$Root) {
    $p = Get-FullPath $Path
    $r = Get-FullPath $Root
    $p.Equals($r, [StringComparison]::OrdinalIgnoreCase) -or $p.StartsWith($r + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
}

function Get-SafeChild([string]$Root, [string]$Relative) {
    if ([IO.Path]::IsPathRooted($Relative) -or $Relative -match '(^|[\\/])\.\.([\\/]|$)' -or $Relative.Contains(':')) { throw '文件清单包含无效路径。' }
    $path = Get-FullPath (Join-Path $Root $Relative)
    if (!(Test-Within $path $Root) -or $path -eq (Get-FullPath $Root)) { throw '文件路径超出安装目录。' }
    $path
}

function Select-UniquePaths([string[]]$Paths) {
    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($path in $Paths) { if ($path -and $seen.Add((Get-FullPath $path))) { Get-FullPath $path } }
}

function Resolve-LeagueDirectory([string]$Hint) {
    if ([string]::IsNullOrWhiteSpace($Hint)) { return }
    try {
        $path = Get-FullPath $Hint
        if ([IO.Path]::GetExtension($path) -eq '.exe') { $path = Split-Path -Parent $path }
        $parent = Split-Path -Parent $path
        $roots = @($path, $parent)
        if ($parent) { $roots += Split-Path -Parent $parent }
        foreach ($root in $roots) {
            if (!$root) { continue }
            foreach ($candidate in @($root, (Join-Path $root 'LeagueClient'))) {
                if ((Test-Path -LiteralPath (Join-Path $candidate 'LeagueClient.exe') -PathType Leaf) -and
                    (Test-Path -LiteralPath (Join-Path $candidate 'LeagueClientUx.exe') -PathType Leaf)) { return Get-FullPath $candidate }
            }
        }
    } catch { return }
}

function Get-DebuggerValue {
    $hive = [Microsoft.Win32.RegistryKey]::OpenBaseKey('LocalMachine', 'Registry64')
    try {
        $key = $hive.OpenSubKey($script:IfeoKey)
        if ($key) { try { return [string]$key.GetValue('Debugger', '') } finally { $key.Dispose() } }
        return ''
    } finally { $hive.Dispose() }
}

function Get-DebuggerCore([string]$Value) {
    if ($Value -match '(?i)(?:^|[\\/])?rundll32(?:\.exe)?\s+"([^"]+[\\/]core\.dll)"\s*,\s*#6000\s*$') { return Get-FullPath $matches[1] }
}

function Get-LinkTarget([string]$Path) {
    if (!(Test-Path -LiteralPath $Path)) { return }
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        $target = @($item.Target)[0]
        if (![IO.Path]::IsPathRooted($target)) { $target = Join-Path (Split-Path -Parent $Path) $target }
        return Get-FullPath $target
    }
}

function Get-LoaderCandidates {
    $paths = New-Object 'System.Collections.Generic.List[string]'
    $core = Get-DebuggerCore (Get-DebuggerValue)
    if ($core) { $paths.Add((Split-Path -Parent $core)) }
    foreach ($root in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
        if ($root) { $paths.Add((Join-Path $root 'Pengu Loader')) }
    }
    foreach ($base in @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall')) {
        foreach ($key in @(Get-ChildItem -LiteralPath $base -ErrorAction SilentlyContinue)) {
            $values = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
            if ($values -and $values.PSObject.Properties['DisplayName'] -and $values.DisplayName -match '^Pengu Loader' -and $values.PSObject.Properties['InstallLocation']) {
                $paths.Add([string]$values.InstallLocation)
            }
        }
    }
    Select-UniquePaths @($paths | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'Pengu Loader.exe') -PathType Leaf) -and (Test-Path -LiteralPath (Join-Path $_ 'core.dll') -PathType Leaf) })
}

function Get-LeagueCandidates {
    $hints = New-Object 'System.Collections.Generic.List[string]'
    foreach ($process in @(Get-CimInstance Win32_Process -Filter "Name='LeagueClient.exe' OR Name='LeagueClientUx.exe'" -ErrorAction SilentlyContinue)) {
        if ($process.ExecutablePath) { $hints.Add($process.ExecutablePath) }
    }
    foreach ($loader in @(Get-LoaderCandidates)) {
        $config = Join-Path $loader 'config'
        if (Test-Path -LiteralPath $config) {
            foreach ($line in [IO.File]::ReadAllLines($config)) { if ($line -match '^\s*LeaguePath\s*=(.*)$') { $hints.Add($matches[1]) } }
        }
    }
    foreach ($base in @('HKCU:\SOFTWARE\Riot Games', 'HKLM:\SOFTWARE\Riot Games', 'HKLM:\SOFTWARE\WOW6432Node\Riot Games', 'HKCU:\SOFTWARE\Tencent\LOL', 'HKLM:\SOFTWARE\WOW6432Node\Tencent\LOL')) {
        foreach ($key in @((Get-Item -LiteralPath $base -ErrorAction SilentlyContinue)) + @(Get-ChildItem -LiteralPath $base -Recurse -ErrorAction SilentlyContinue)) {
            if (!$key) { continue }
            $values = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
            foreach ($field in @('InstallLocation','InstallPath','LocalRootFolder','Path')) {
                if ($values -and $values.PSObject.Properties[$field] -and $values.$field -is [string]) { $hints.Add($values.$field) }
            }
        }
    }
    foreach ($base in @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall')) {
        foreach ($key in @(Get-ChildItem -LiteralPath $base -ErrorAction SilentlyContinue)) {
            $v = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
            if ($v -and $v.PSObject.Properties['DisplayName'] -and $v.DisplayName -match '英雄联盟|League of Legends' -and $v.PSObject.Properties['InstallLocation']) { $hints.Add([string]$v.InstallLocation) }
        }
    }
    $riotFile = Join-Path $env:ProgramData 'Riot Games\RiotClientInstalls.json'
    if (Test-Path -LiteralPath $riotFile) {
        try {
            $json = Get-Content -LiteralPath $riotFile -Raw | ConvertFrom-Json
            if ($json.PSObject.Properties['associated_client']) { foreach ($entry in $json.associated_client.PSObject.Properties) { $hints.Add($entry.Name) } }
        } catch {}
    }
    $metadata = Join-Path $env:ProgramData 'Riot Games\Metadata'
    foreach ($product in @(Get-ChildItem -LiteralPath $metadata -Directory -ErrorAction SilentlyContinue | Where-Object Name -Like 'league_of_legends.*')) {
        foreach ($file in @(Get-ChildItem -LiteralPath $product.FullName -Filter '*.yaml' -File -ErrorAction SilentlyContinue)) {
            foreach ($line in [IO.File]::ReadAllLines($file.FullName)) { if ($line -match '^\s*(?:product_install_root|product_install_full_path):\s*["'']?(.*?)["'']?\s*$') { $hints.Add($matches[1]) } }
        }
    }
    try {
        $shell = New-Object -ComObject WScript.Shell
        foreach ($folder in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('CommonDesktopDirectory'),[Environment]::GetFolderPath('StartMenu'),[Environment]::GetFolderPath('CommonStartMenu'))) {
            foreach ($link in @(Get-ChildItem -LiteralPath $folder -Filter '*.lnk' -File -Recurse -ErrorAction SilentlyContinue | Where-Object Name -Match '英雄联盟|League')) {
                $target = $shell.CreateShortcut($link.FullName).TargetPath
                if ($target) { $hints.Add($target) }
            }
        }
    } catch {} finally { if (Get-Variable shell -ErrorAction SilentlyContinue) { if ($shell) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell) } } }
    foreach ($drive in @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction SilentlyContinue)) {
        foreach ($relative in @('英雄联盟','League of Legends','WeGameApps\英雄联盟','WeGame\英雄联盟','Tencent\英雄联盟','Tencent Games\英雄联盟','Riot Games\League of Legends','Games\英雄联盟','Games\League of Legends','Program Files\Tencent\英雄联盟','Program Files (x86)\Tencent\英雄联盟','Program Files\Riot Games\League of Legends')) {
            $hints.Add((Join-Path ($drive.DeviceID + '\') $relative))
        }
    }
    Select-UniquePaths @($hints | ForEach-Object { Resolve-LeagueDirectory $_ } | Where-Object { $_ })
}

function Select-LeagueDirectory([string]$Provided, [string[]]$Candidates) {
    if ($Provided) {
        $resolved = Resolve-LeagueDirectory $Provided
        if ($resolved) { return $resolved }
        Write-Step '指定的目录没有找到完整客户端，请重新选择。'
    } elseif ($Candidates.Count -eq 1) { return $Candidates[0] }
    elseif ($Candidates.Count -gt 1) {
        Write-Step '找到多个客户端，请选择要安装到的客户端：'
        for ($i=0; $i -lt $Candidates.Count; $i++) { Write-Step ('  {0}. {1}' -f ($i+1),$Candidates[$i]) }
        while ($true) {
            $answer = Read-Host '输入序号，或直接粘贴客户端目录（Q 退出）'
            if ($answer -ieq 'q') { throw '已取消安装。' }
            $index = 0
            if ([int]::TryParse($answer,[ref]$index) -and $index -gt 0 -and $index -le $Candidates.Count) { return $Candidates[$index-1] }
            $resolved = Resolve-LeagueDirectory $answer
            if ($resolved) { return $resolved }
            Write-Step '没有找到 LeagueClient.exe 和 LeagueClientUx.exe，请重新输入。'
        }
    }
    while ($true) {
        $answer = Read-Host '粘贴英雄联盟目录或其中的 LeagueClient 文件夹路径（Q 退出）'
        if ($answer -ieq 'q') { throw '已取消安装。' }
        $resolved = Resolve-LeagueDirectory $answer
        if ($resolved) { return $resolved }
        Write-Step '没有找到完整客户端，请确认文件夹中存在 LeagueClient.exe 和 LeagueClientUx.exe。'
    }
}

function Copy-SafeTree([string]$Source, [string]$Destination) {
    if ((Get-Item -LiteralPath $Source -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw ('请先处理目录链接：' + $Source) }
    [IO.Directory]::CreateDirectory($Destination) | Out-Null
    foreach ($entry in @(Get-ChildItem -LiteralPath $Source -Force -Recurse)) {
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw ('请先处理目录链接：' + $entry.FullName) }
        $relative = $entry.FullName.Substring((Get-FullPath $Source).Length+1)
        $target = Get-SafeChild $Destination $relative
        if ($entry.PSIsContainer) { [IO.Directory]::CreateDirectory($target) | Out-Null }
        else { [IO.Directory]::CreateDirectory((Split-Path -Parent $target)) | Out-Null; Copy-Item -LiteralPath $entry.FullName -Destination $target -Force }
    }
}

function Test-Package([string]$Root) {
    $manifest = Get-Content -LiteralPath (Join-Path $Root 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.schema -ne 1) { throw '安装包格式不受支持，请重新下载完整 ZIP。' }
    foreach ($entry in $manifest.files) {
        $file = Get-SafeChild $Root $entry.path
        if (!(Test-Path -LiteralPath $file -PathType Leaf) -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $entry.sha256) { throw ('文件校验失败，请重新解压：' + $entry.path) }
    }
    foreach ($required in @('sona/index.js','sona/index.css','PenguLoader/Pengu Loader.exe','PenguLoader/core.dll')) {
        if (!($manifest.files | Where-Object path -EQ $required)) { throw ('安装包缺少：' + $required) }
    }
    $manifest
}

function Set-LoaderConfig([string]$Path, [hashtable]$Values) {
    $lines = New-Object 'System.Collections.Generic.List[string]'
    $seen = @{}
    if (Test-Path -LiteralPath $Path) {
        foreach ($line in [IO.File]::ReadAllLines($Path)) {
            if ($line -match '^\s*([^#;=]+?)\s*=' -and $Values.ContainsKey($matches[1])) {
                $key = $matches[1]
                if (!$seen.ContainsKey($key)) { $lines.Add($key+'='+$Values[$key]); $seen[$key]=$true }
            } else { $lines.Add($line) }
        }
    }
    foreach ($key in $Values.Keys) { if (!$seen.ContainsKey($key)) { $lines.Add($key+'='+$Values[$key]) } }
    [IO.File]::WriteAllLines($Path,$lines.ToArray(),(New-Object Text.UTF8Encoding($false)))
}

function Get-ConfigValue([string]$Path, [string]$Key) {
    if (Test-Path -LiteralPath $Path) {
        foreach ($line in [IO.File]::ReadAllLines($Path)) { if ($line -match ('^\s*'+[regex]::Escape($Key)+'\s*=(.*)$')) { return $matches[1].Trim() } }
    }
}

function Get-SonaHash {
    $hash=[uint64]2166136261
    foreach($byte in [Text.Encoding]::UTF8.GetBytes('sona/index.js')) { $hash=(($hash -bxor $byte)*[uint64]16777619) -band [uint64]4294967295 }
    '{0:x}' -f $hash
}

function Get-DeploymentFile([string]$Root,[string]$Plugins,[string]$Relative) {
    if ($Relative.StartsWith('plugins\',[StringComparison]::OrdinalIgnoreCase)) { return Get-SafeChild $Plugins $Relative.Substring(8) }
    Get-SafeChild $Root $Relative
}

function Invoke-PenguActivation([string]$LoaderDir) {
    $process = Start-Process -FilePath (Join-Path $LoaderDir 'Pengu Loader.exe') -ArgumentList '--install' -WorkingDirectory $LoaderDir -WindowStyle Hidden -PassThru
    if (!$process.WaitForExit(30000)) { $process.Kill(); throw 'Pengu Loader 激活超时，已停止本次安装进程。' }
    if ($process.ExitCode -ne 0) { throw ('Pengu Loader 激活失败，退出码：'+$process.ExitCode) }
}

function Test-PenguActivation([string]$LoaderDir, [string]$LeagueDir, [bool]$Symlink) {
    $core = Get-FullPath (Join-Path $LoaderDir 'core.dll')
    if ($Symlink) { return (Get-LinkTarget (Join-Path $LeagueDir 'version.dll')) -eq $core }
    (Get-DebuggerCore (Get-DebuggerValue)) -eq $core
}

function Restore-DebuggerValue([string]$Previous, [string]$Core) {
    $current = Get-DebuggerValue
    if ($current -eq $Previous) { return }
    if ((Get-DebuggerCore $current) -ne (Get-FullPath $Core)) { throw '客户端激活项已被其他程序更改，请使用备份记录检查。' }
    $hive = [Microsoft.Win32.RegistryKey]::OpenBaseKey('LocalMachine','Registry64')
    try {
        $key = $hive.CreateSubKey($script:IfeoKey)
        try {
            if ($Previous) { $key.SetValue('Debugger',$Previous,[Microsoft.Win32.RegistryValueKind]::String) }
            else { $key.DeleteValue('Debugger',$false) }
        } finally { $key.Dispose() }
    } finally { $hive.Dispose() }
}

function Enable-NewLoaderPermissions([string]$LoaderDir) {
    $acl = Get-Acl -LiteralPath $LoaderDir
    $sid = New-Object Security.Principal.SecurityIdentifier('S-1-5-32-545')
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid,'Modify','ContainerInherit, ObjectInherit','None','Allow')
    $acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $LoaderDir -AclObject $acl
}

function Invoke-SonaDeployment([string]$PackageRoot,[string]$LeagueDir,[string]$LoaderDir,[string]$BackupRoot) {
    $LoaderDir = Get-FullPath $LoaderDir
    if ($LoaderDir.Length -le [IO.Path]::GetPathRoot($LoaderDir).Length+3 -or (Test-Within $LoaderDir $LeagueDir) -or (Test-Within $LeagueDir $LoaderDir) -or
        (Test-Within $PackageRoot $LoaderDir) -or (Test-Within $BackupRoot $LoaderDir)) { throw '安装目录必须独立于客户端、解压目录和备份目录。' }
    $manifest = Test-Package $PackageRoot
    $previousDebugger = Get-DebuggerValue
    $otherCore = Get-DebuggerCore $previousDebugger
    if ($previousDebugger -and (!$otherCore -or $otherCore -ne (Get-FullPath (Join-Path $LoaderDir 'core.dll')))) { throw '客户端已有其他激活项，请先用原加载器停用后再安装，原配置尚未改动。' }
    $config = Join-Path $LoaderDir 'config'
    $pluginsSetting = [string](Get-ConfigValue $config 'plugins_dir')
    $pluginsDir = Join-Path $LoaderDir 'plugins'
    if ($pluginsSetting) {
        if (![IO.Path]::IsPathRooted($pluginsSetting)) { throw '现有 plugins_dir 是相对路径，请在 Loader 配置中改成绝对路径后重试。' }
        $pluginsDir=Get-FullPath $pluginsSetting
        if ($pluginsDir.Length -le [IO.Path]::GetPathRoot($pluginsDir).Length+3 -or (Test-Within $LoaderDir $pluginsDir) -or
            (Test-Within $LeagueDir $pluginsDir) -or (Test-Within $pluginsDir $LeagueDir) -or (Test-Within $PackageRoot $pluginsDir) -or (Test-Within $BackupRoot $pluginsDir)) { throw '现有插件目录与客户端或备份目录重叠，未改动。' }
    }
    $useSymlink = [string](Get-ConfigValue $config 'UseSymlink') -match '^(?i:true|1)$'
    $linkPath = Join-Path $LeagueDir 'version.dll'
    $previousLink = Get-LinkTarget $linkPath
    if ($useSymlink -and (Test-Path -LiteralPath $linkPath) -and $previousLink -ne (Get-FullPath (Join-Path $LoaderDir 'core.dll'))) { throw '客户端 version.dll 已存在且不属于当前 Pengu Loader，未覆盖。' }
    $hadLoader = Test-Path -LiteralPath $LoaderDir
    $hadRuntime = Test-Path -LiteralPath (Join-Path $LoaderDir 'Pengu Loader.exe')
    $backupDir = Join-Path $BackupRoot ((Get-Date -Format 'yyyyMMdd_HHmmss')+'_'+[guid]::NewGuid().ToString('N').Substring(0,8))
    [IO.Directory]::CreateDirectory($backupDir) | Out-Null
    $snapshot = Join-Path $backupDir 'PenguLoader'
    if ($hadLoader) { Write-Step '正在完整备份原 Loader、插件与设置……'; Copy-SafeTree $LoaderDir $snapshot }
    $snapshotPlugins=Join-Path $snapshot 'plugins'
    if ($pluginsSetting) {
        if (Test-Within $pluginsDir $LoaderDir) { $snapshotPlugins=Get-SafeChild $snapshot $pluginsDir.Substring($LoaderDir.Length+1) }
        else {
            $snapshotPlugins=Join-Path $backupDir 'ExternalPlugins'
            if (Test-Path -LiteralPath $pluginsDir) { Copy-SafeTree $pluginsDir $snapshotPlugins }
        }
    }
    $written = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $metadata = @{schema=1;version=$manifest.version;loaderDir=$LoaderDir;pluginsDir=$pluginsDir;leagueDir=$LeagueDir;previousDebugger=$previousDebugger;previousLink=$previousLink;hadLoader=$hadLoader}
    $metadata | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupDir 'backup.json') -Encoding UTF8
    try {
        $stagedSona = Join-Path $backupDir 'staging\sona'
        $oldSona = Join-Path $pluginsDir 'sona'
        Copy-SafeTree (Join-Path $PackageRoot 'sona') $stagedSona
        if (Test-Path -LiteralPath (Join-Path $oldSona 'assets')) { Copy-SafeTree (Join-Path $oldSona 'assets') (Join-Path $stagedSona 'assets') }
        Copy-SafeTree (Join-Path $PackageRoot 'sona\assets\licenses') (Join-Path $stagedSona 'assets\licenses')
        [IO.Directory]::CreateDirectory($LoaderDir) | Out-Null
        if (!$hadRuntime) { Enable-NewLoaderPermissions $LoaderDir }
        $copyRuntime = $true
        if (Test-Path -LiteralPath (Join-Path $LoaderDir 'version')) {
            $versionText = [IO.File]::ReadAllText((Join-Path $LoaderDir 'version'))
            if ($versionText -match '^(\d+\.\d+\.\d+)') { $copyRuntime = [version]$matches[1] -le [version]$manifest.penguVersion }
        }
        if ($copyRuntime) {
            foreach ($file in @(Get-ChildItem -LiteralPath (Join-Path $PackageRoot 'PenguLoader') -File)) {
                [void]$written.Add($file.Name)
                Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $LoaderDir $file.Name) -Force
            }
        } else { Write-Step '已有较新的 Pengu Loader，保留现有版本。' }
        foreach ($file in @(Get-ChildItem -LiteralPath $stagedSona -File -Recurse -Force)) {
            $relative = 'plugins\sona\'+$file.FullName.Substring((Get-FullPath $stagedSona).Length+1)
            $target = Get-DeploymentFile $LoaderDir $pluginsDir $relative
            [void]$written.Add($relative)
            [IO.Directory]::CreateDirectory((Split-Path -Parent $target)) | Out-Null
            Copy-Item -LiteralPath $file.FullName -Destination $target -Force
        }
        $disabledEntry = Join-Path $pluginsDir 'sona\index.js_'
        if (Test-Path -LiteralPath $disabledEntry) { [void]$written.Add('plugins\sona\index.js_'); Remove-Item -LiteralPath $disabledEntry -Force }
        [void]$written.Add('config')
        $values = @{LeaguePath=$LeagueDir;UseSymlink=$useSymlink.ToString().ToLowerInvariant()}
        $disabledHashes=[string](Get-ConfigValue $config 'disabled_plugins')
        if ($disabledHashes) { $values.disabled_plugins=(@($disabledHashes.Split(',') | Where-Object {$_.Trim() -ine (Get-SonaHash)}) -join ',') }
        if (!(Get-ConfigValue $config 'Language')) { $values.Language='中文' }
        Set-LoaderConfig $config $values
        Write-Step '正在激活 Pengu Loader……'
        Invoke-PenguActivation $LoaderDir
        if (!(Test-PenguActivation $LoaderDir $LeagueDir $useSymlink)) { throw '激活结果校验未通过。' }
        foreach ($name in @('index.js','index.css')) {
            if ((Get-FileHash -LiteralPath (Join-Path $PackageRoot ('sona\'+$name))).Hash -ne (Get-FileHash -LiteralPath (Join-Path $pluginsDir ('sona\'+$name))).Hash) { throw ('安装文件校验失败：'+$name) }
        }
        $metadata.written=@($written)
        $metadata.status='installed'
        $metadata | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupDir 'backup.json') -Encoding UTF8
        Write-Step ('安装完成：Sona '+$manifest.version)
        Write-Step ('客户端：'+$LeagueDir)
        Write-Step ('Loader：'+$LoaderDir)
        Write-Step ('备份：'+$backupDir)
        Write-Step '现在可重新启动英雄联盟客户端，按 F1 打开 Sona。'
        return $backupDir
    } catch {
        $failure = $_
        Write-Step '安装未完成，正在恢复本次修改……'
        try {
            Restore-DebuggerValue $previousDebugger (Join-Path $LoaderDir 'core.dll')
            if ($useSymlink -and !$previousLink -and (Get-LinkTarget $linkPath) -eq (Get-FullPath (Join-Path $LoaderDir 'core.dll'))) { Remove-Item -LiteralPath $linkPath -Force }
            foreach ($relative in $written) {
                $target = Get-DeploymentFile $LoaderDir $pluginsDir $relative
                $original = Get-DeploymentFile $snapshot $snapshotPlugins $relative
                if (Test-Path -LiteralPath $original -PathType Leaf) { Copy-Item -LiteralPath $original -Destination $target -Force }
                elseif (Test-Path -LiteralPath $target -PathType Leaf) { Remove-Item -LiteralPath $target -Force }
            }
            Write-Step '本次文件与激活项已恢复，备份已保留。'
        } catch { Write-Step ('自动恢复遇到问题，完整备份在 '+$backupDir+'；原因：'+$_.Exception.Message) }
        throw $failure
    }
}

function Ensure-Prerequisites([string]$PackageRoot,[string]$CacheRoot) {
    $net = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' -ErrorAction SilentlyContinue
    if (!$net -or !$net.PSObject.Properties['Release'] -or $net.Release -lt 461808) { throw '需要 .NET Framework 4.7.2 或更高版本。请通过 Windows 更新安装 .NET Framework 4.8 后重试。' }
    $vc = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64' -ErrorAction SilentlyContinue
    if ($vc -and $vc.PSObject.Properties['Installed'] -and $vc.Installed -eq 1 -and $vc.PSObject.Properties['Version'] -and [version]$vc.Version.TrimStart('v') -ge [version]'14.44.35211.0') { return }
    Write-Step '缺少所需 C++ 运行库，正在从微软官网下载……'
    $vendor = Get-Content -LiteralPath (Join-Path $PackageRoot 'vendor.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    [IO.Directory]::CreateDirectory($CacheRoot) | Out-Null
    $file = Join-Path $CacheRoot 'VC_redist.x64.exe'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $vendor.vcRuntime.url -OutFile $file -UseBasicParsing
    if ((Get-FileHash -LiteralPath $file).Hash -ne $vendor.vcRuntime.sha256) { throw '微软运行库下载校验失败，请检查网络后重试。' }
    $signature = Get-AuthenticodeSignature -LiteralPath $file
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') { throw '微软运行库签名校验失败，未执行。' }
    $process = Start-Process -FilePath $file -ArgumentList '/install /quiet /norestart' -WindowStyle Hidden -Wait -PassThru
    if ($process.ExitCode -notin @(0,1638,3010)) { throw ('C++ 运行库安装失败，退出码：'+$process.ExitCode) }
    if ($process.ExitCode -eq 3010) { Write-Step '系统运行库提示需要重启电脑；请安装完成后重启。' }
}

function Start-SonaInstaller {
    if (![Environment]::Is64BitOperatingSystem -or ![Environment]::Is64BitProcess) { throw '请在 64 位 Windows 10 / 11 上运行一键安装.cmd。' }
    if ($Diagnose) {
        Write-Step '只读检测，不安装或更改设置。'
        Write-Step ('Loader 候选：'+(@(Get-LoaderCandidates) -join '；'))
        Write-Step ('客户端候选：'+(@(Get-LeagueCandidates) -join '；'))
        return
    }
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Step '安装需要一次 Windows 管理员授权，正在打开安装窗口……'
        $command = "& '"+$script:InstallerFile.Replace("'","''")+"'"
        if ($LeaguePath) { $command += " -LeaguePath '"+$LeaguePath.Replace("'","''")+"'" }
        $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
        $process = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand',$encoded) -Verb RunAs -WindowStyle Normal -Wait -PassThru
        if ($process.ExitCode -ne 0) { throw '安装未完成，请查看管理员窗口中的提示。' }
        return
    }
    $root = Split-Path -Parent $script:InstallerFile
    Test-Package $root | Out-Null
    $dataRoot = Join-Path $env:ProgramData 'Sona'
    [IO.Directory]::CreateDirectory((Join-Path $dataRoot 'Logs')) | Out-Null
    $script:LogFile = Join-Path $dataRoot ('Logs\install_'+(Get-Date -Format 'yyyyMMdd_HHmmss')+'.log')
    Write-Step 'Sona 一键安装'
    $leagueDir = Select-LeagueDirectory $LeaguePath @(Get-LeagueCandidates)
    Write-Step ('已找到客户端：'+$leagueDir)
    while (@(Get-Process -Name LeagueClient,LeagueClientUx,'League of Legends','Pengu Loader' -ErrorAction SilentlyContinue).Count -gt 0) {
        if ((Read-Host '请退出英雄联盟客户端和 Pengu Loader 后按回车重试（Q 退出）') -ieq 'q') { throw '已取消，未更改当前客户端。' }
    }
    $loaders = @(Get-LoaderCandidates)
    $linkedCore = Get-LinkTarget (Join-Path $leagueDir 'version.dll')
    if ($linkedCore -and (Split-Path -Leaf $linkedCore) -ieq 'core.dll' -and (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $linkedCore) 'Pengu Loader.exe'))) { $loaders = @((Split-Path -Parent $linkedCore)) + $loaders }
    $loaderDir = if ($loaders.Count) { $loaders[0] } else { Join-Path $env:ProgramFiles 'Pengu Loader' }
    Ensure-Prerequisites $root (Join-Path $dataRoot 'Downloads')
    Invoke-SonaDeployment $root $leagueDir $loaderDir (Join-Path $dataRoot 'Backups') | Out-Null
    Write-Step ('安装日志：'+$script:LogFile)
}

if ($MyInvocation.InvocationName -ne '.') {
    $result = 0
    try { Start-SonaInstaller }
    catch { Write-Step ('安装未完成：'+$_.Exception.Message); if ($script:LogFile) { Write-Host ('日志：'+$script:LogFile) }; $result=1 }
    if (!$NoPause -and !$Diagnose) { [void](Read-Host '按回车关闭') }
    exit $result
}
