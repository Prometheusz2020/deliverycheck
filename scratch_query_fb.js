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

    // Let's list tables containing TIPO_PAGAMENTO or similar
    const sql = `
        SELECT ID, DESCRICAO FROM ECF_TIPO_PAGAMENTO
    `;

    db.query(sql, (err, result) => {
        if (err) {
            console.error('[-] Error querying ECF_TIPO_PAGAMENTO:', err.message);
            // Let's list all columns of ECF_TIPO_PAGAMENTO if it failed because of column names
            db.query(`
                SELECT r.rdb$field_name AS field_name
                FROM rdb$relation_fields r
                WHERE r.rdb$relation_name = 'ECF_TIPO_PAGAMENTO'
            `, (err2, result2) => {
                if (!err2) {
                    console.log('Columns in ECF_TIPO_PAGAMENTO:', result2.map(x => x.FIELD_NAME.trim()));
                }
                db.detach();
            });
            return;
        }

        console.log('[+] Payment methods (ECF_TIPO_PAGAMENTO):');
        result.forEach(row => {
            console.log(` - ID: ${row.ID}, DESCRICAO: ${row.DESCRICAO ? String(row.DESCRICAO).trim() : 'null'}`);
        });

        // Query some recent payments to see how they look
        db.query(`
            SELECT FIRST 10 P.ID, P.ID_ECF_VENDA_CABECALHO, P.ID_ECF_TIPO_PAGAMENTO, P.VALOR, TP.DESCRICAO
            FROM ECF_TOTAL_TIPO_PAGAMENTO P
            LEFT JOIN ECF_TIPO_PAGAMENTO TP ON TP.ID = P.ID_ECF_TIPO_PAGAMENTO
            ORDER BY P.ID DESC
        `, (err3, payments) => {
            if (!err3 && payments) {
                console.log('\n[+] Recent payments:');
                payments.forEach(p => {
                    console.log(` - ID: ${p.ID}, SaleID: ${p.ID_ECF_VENDA_CABECALHO}, TypeID: ${p.ID_ECF_TIPO_PAGAMENTO} (${p.DESCRICAO.trim()}), Value: ${p.VALOR}`);
                });
            } else if (err3) {
                console.error('[-] Error querying recent payments:', err3.message);
            }
            db.detach();
        });
    });
});
