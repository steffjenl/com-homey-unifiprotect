import json
data = json.load(open('/Users/stephan/Projects/Homey/com-homey-unifiprotect/app.json','r',encoding='utf-8'))
fob_ids = set(['ufp_device_fob_button','ufp_device_fob_button_press','ufp_device_fob_button_long_press','ufp_device_fob_button_double_press','ufp_device_fob_button_arm','ufp_device_fob_button_disarm','ufp_device_fob_button_panic','ufp_device_fob_button_night','ufp_device_fob_button_left','ufp_device_fob_button_right'])
expected = set(['en','nl','de','fr','it','sv','no','es','da','ru','pl','ko'])
all_ok = True
for card in data.get('flow',{}).get('triggers',[]):
    if card['id'] not in fob_ids:
        continue
    for field in ['title','titleFormatted']:
        missing = expected - set(card.get(field,{}).keys())
        if missing:
            print('MISSING '+field+' ['+card['id']+']: '+str(missing))
            all_ok = False
    for t in card.get('tokens',[]):
        missing_tok = expected - set(t.get('title',{}).keys())
        if missing_tok:
            print('MISSING token ['+card['id']+'] '+t['name']+': '+str(missing_tok))
            all_ok = False
if all_ok:
    print('All FOB trigger cards fully translated in app.json.')

