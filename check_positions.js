const { db } = require('./database/connection');

async function checkData() {
    console.log("Checking Salary Types...");
    const stSnap = await db.collection('salary_types').get();
    if (stSnap.empty) {
        console.log("NO Salary Types found.");
    } else {
        stSnap.forEach(d => console.log(`SalaryType: ${d.id} - ${d.data().name}`));
    }

    console.log("\nChecking Positions...");
    const pSnap = await db.collection('positions').get();
    if (pSnap.empty) {
        console.log("NO Positions found.");
    } else {
        pSnap.forEach(d => console.log(`Position: ${d.data().name} (${d.data().department})`));
    }
}

checkData().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
