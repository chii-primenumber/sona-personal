export const avgOrZero = (values: number[]) => values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0
