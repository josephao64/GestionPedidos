const registros = [
  { empleadoId: '1', fecha: '2026-03-26' },
  { empleadoId: '1', fecha: '2026-03-27' },
];

function validateDescansoRule(empleadoId, dateStr, ruleValParam) {
    const targetDate = new Date(dateStr + 'T12:00:00');
    const ruleVal = ruleValParam;

    const jan1 = new Date(targetDate.getFullYear(), 0, 1);
    const startDayOffset = jan1.getDay(); // 0(Dom) a 6(Sab)
    const daysSinceJan1 = Math.floor((targetDate - jan1) / (24 * 60 * 60 * 1000));
    
    const weekNum = Math.ceil((daysSinceJan1 + startDayOffset + 1) / 7);
    const blockNum = Math.floor((weekNum - 1) / ruleVal);
    
    const count = registros.filter(r => {
        if (r.empleadoId !== empleadoId) return false;
        const rDate = new Date(r.fecha + 'T12:00:00');
        if (rDate.getFullYear() !== targetDate.getFullYear()) return false;
        
        const rDaysSince = Math.floor((rDate - jan1) / (24 * 60 * 60 * 1000));
        const rWeekNum = Math.ceil((rDaysSince + startDayOffset + 1) / 7);
        const rBlockNum = Math.floor((rWeekNum - 1) / ruleVal);
        
        return rBlockNum === blockNum;
    }).length;
    
    return { count, ruleVal, isValid: count <= ruleVal, weekNum, blockNum };
}

console.log("Mar 26", validateDescansoRule('1', '2026-03-26', 2));
console.log("Mar 27", validateDescansoRule('1', '2026-03-27', 2));
