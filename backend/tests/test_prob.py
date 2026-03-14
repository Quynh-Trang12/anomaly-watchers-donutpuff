import requests

presets = [
    {
        'id': 'normal_payment',
        'type': 'PAYMENT', 'amount': 5000, 'oldbalanceOrg': 150000, 'newbalanceOrig': 145000,
        'oldbalanceDest': 0, 'newbalanceDest': 5000
    },
    {
        'id': 'large_transfer',
        'type': 'TRANSFER', 'amount': 140000, 'oldbalanceOrg': 150000, 'newbalanceOrig': 10000,
        'oldbalanceDest': 0, 'newbalanceDest': 140000
    },
    {
        'id': 'suspicious_cashout',
        'type': 'CASH OUT', 'amount': 25000, 'oldbalanceOrg': 25000, 'newbalanceOrig': 0,
        'oldbalanceDest': 0, 'newbalanceDest': 25000
    },
    {
        'id': 'large_cashin',
        'type': 'CASH IN', 'amount': 180000, 'oldbalanceOrg': 0, 'newbalanceOrig': 180000,
        'oldbalanceDest': 180000, 'newbalanceDest': 0
    },
    {
        'id': 'small_debit',
        'type': 'DEBIT', 'amount': 500, 'oldbalanceOrg': 50000, 'newbalanceOrig': 49500,
        'oldbalanceDest': 0, 'newbalanceDest': 500
    },
    {
        'id': 'known_fraud_pattern',
        'type': 'TRANSFER', 'amount': 50000, 'oldbalanceOrg': 50000, 'newbalanceOrig': 0,
        'oldbalanceDest': 0, 'newbalanceDest': 50000
    }
]

for p in presets:
    pay = {
        'step': 1,
        'type': p['type'],
        'amount': p['amount'],
        'oldbalanceOrg': p['oldbalanceOrg'],
        'newbalanceOrig': p['newbalanceOrig'],
        'oldbalanceDest': p['oldbalanceDest'],
        'newbalanceDest': p['newbalanceDest']
    }
    r = requests.post('http://127.0.0.1:8000/predict/primary', json=pay)
    data = r.json()
    print(f"{p['id']}: code={r.status_code}, prob={data.get('probability')}, risk={data.get('risk_level')}")
