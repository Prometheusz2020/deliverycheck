require('dotenv').config();
const Firebird = require('node-firebird');

const fbOptions = {
    host: process.env.FB_HOST || '127.0.0.1',
    port: parseInt(process.env.FB_PORT || '3050'),
    database: process.env.FB_DATABASE || 'C:\\Gplus\\DADOS\\GPLUS.FDB',
    user: process.env.FB_USER || 'SYSDBA',
    password: process.env.FB_PASSWORD || 'masterkey',
};

Firebird.attach(fbOptions, (err, db) => {
    if (err) {
        console.error('[-] Error connecting to Firebird:', err.message);
        return;
    }
    console.log('[+] Connected to Firebird database!');

    // Query tables containing RECEB, PAG, FORM, TIPO, MEIO
    const sql = `
        SELECT rdb$relation_name AS TABLE_NAME
        FROM rdb$relations
        WHERE rdb$view_context IS NULL
        AND (rdb$relation_name LIKE '%RECEB%'
             OR rdb$relation_name LIKE '%PAG%'
             OR rdb$relation_name LIKE '%FORM%'
             OR rdb$relation_name LIKE '%TIPO%'
             OR rdb$relation_name LIKE '%MEIO%')
        ORDER BY TABLE_NAME
    `;

    db.query(sql, (err, result) => {
        if (err) {
            console.error('[-] Error querying tables:', err.message);
            db.detach();
            return;
        }

        console.log('[+] Found tables matching search:');
        result.forEach(row => {
            console.log(' -', row.TABLE_NAME.trim());
        });

        // Let's also check if there are columns in ECF_VENDA_CABECALHO containing OBSERVACAO or other info
        db.query(`SELECT FIRST 5 ID, OBSERVACAO, REFATURADO FROM ECF_VENDA_CABECALHO WHERE DATA_VENDA = CURRENT_DATE`, (err, rows) => {
            if (!err && rows && rows.length > 0) {
                console.log('\n[+] Sample rows from ECF_VENDA_CABECALHO:');
                console.log(rows);
            }
            db.detach();
        });
    });
});
