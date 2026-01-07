
const admin = require('firebase-admin');
// We need to read the service account from the user's project if possible, 
// OR we can just try to use the client SDK in a script.
// Given node environment, admin SDK is better, but I'd need credentials.
// A simpler way without credentials is to just create a client-side HTML/JS file that logs to console
// and run it via browser, OR inspect the file I have.
// Wait, I can't easily run admin sdk without service account.
// I will create a temporary HTML file debug_data.html that uses the existing firebase config
// and prints the analysis to the page.

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Debug Data</title>
    <script src="https://www.gstatic.com/firebasejs/8.6.8/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.6.8/firebase-firestore.js"></script>
    <script src="security-config.js"></script>
    <script src="database/connection.js"></script>
</head>
<body>
    <h1>Debug Employees Collection</h1>
    <div id="output">Running analysis...</div>
    <script>
        async function runDebug() {
            const out = document.getElementById('output');
            try {
                const snap = await db.collection('employees').get();
                let total = 0;
                let missingName = 0;
                let inactive = 0;
                let details = [];

                snap.forEach(doc => {
                    total++;
                    const data = doc.data();
                    if (!data.fullName) {
                        missingName++;
                        // Delete invalid document
                        db.collection('employees').doc(doc.id).delete().then(() => {
                            console.log(\`Deleted invalid doc: \${doc.id}\`);
                        });
                        details.push({ id: doc.id, status: 'DELETED' });
                    }
                    if (data.status === 'inactive') {
                        inactive++;
                    }
                });

                out.innerHTML = \`
                    <p style="color: green; font-weight: bold;">CLEANUP COMPLETE</p>
                    <p>Total Scanned: <strong>\${total}</strong></p>
                    <p>Deleted (Missing Name): <strong>\${missingName}</strong></p>
                    <p>Status 'inactive': <strong>\${inactive}</strong></p>
                    <p><em>Please refresh the Dashboard to see corrected counts.</em></p>
                \`;
            } catch (e) {
                out.textContent = 'Error: ' + e.message;
            }
        }
        window.onload = runDebug;
    </script>
</body>
</html>
`;
console.log(htmlContent);
