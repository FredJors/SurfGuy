import json,sys
for f in sys.argv[1:]:
    r=json.load(open(f))
    print('=====', f, 'real', r['realSeconds'], 'errors', len(r['errors']), r['errors'][:2])
    print('warnings', {k:v for k,v in r['warnings'].items() if 'PCFSoft' not in k})
    for run in r['report']:
        print({k: run[k] for k in ['endedBy','seconds','heartsLeft','score','pearls','defeated','escaped','hitsBy','jumps','launches','bossHpLeft','missionsCompleted']})
        t=run['tricks']; print('   tricks rec',t['recognized'],'fail',t['failed'],t['failReasons'],t['byTrick'],'maxAir',round(run['maxAirtime'],2))
        if run['stuck'] or run['anomalies']: print('   stuck', run['stuck'][:6], 'anomalies', run['anomalies'][:6])
