'use strict';

/**
 * Setup wizard for the UniFi Protect app settings.
 *
 * Walks a fresh installation through picking a connection, creating the required
 * credentials in UniFi and saving them. Writes to exactly the same `ufp:*` settings
 * keys as the regular tabs, so the app's settings listener picks the change up and
 * logs in automatically.
 */
(function () {
    const GUIDE_URL = 'https://github.com/steffjenl/com-homey-unifiprotect/blob/develop/wiki/setup-guide.md';
    const GUIDE_ANCHOR = {
        v1: '#1-unifi-protect--create-a-local-user-v1--legacy',
        v2: '#2-unifi-protect--create-an-integration-api-key-v2',
        access: '#3-unifi-access--create-an-integration-api-key',
    };
    const CONNECTIONS = ['v2', 'v1', 'access'];
    const INSTRUCTION_STEPS = {v1: 5, v2: 5, access: 4};
    const DEFAULT_PORT = {v1: '443', v2: '443', access: '12445'};
    const EYE_ICONS = '<svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
        + '<svg class="eye-off-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

    let homey = null;
    let onClose = null;
    let state = null;
    let steps = [];
    let stepIndex = 0;
    let open = false;
    let testResultElement = null;

    const el = (id) => document.getElementById(id);

    // Never returns an empty string: an empty label would hide a validation message
    function t(key) {
        const fullKey = 'settings.wizard.' + key;
        const translation = homey.__(fullKey);
        return translation || fullKey;
    }

    function getSetting(key) {
        return new Promise((resolve) => {
            homey.get(key, (error, value) => resolve(error ? null : value));
        });
    }

    function setSetting(key, value) {
        return new Promise((resolve, reject) => {
            homey.set(key, value, (error) => (error ? reject(error) : resolve()));
        });
    }

    function callApi(method, path, body) {
        return new Promise((resolve, reject) => {
            homey.api(method, path, body, (error, result) => (error ? reject(error) : resolve(result)));
        });
    }

    // ---------------------------------------------------------------- rendering helpers

    function node(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text) element.textContent = text;
        return element;
    }

    function guideLink(section) {
        const link = node('a', 'wizard-guide', t('guide'));
        link.href = GUIDE_URL + (section && GUIDE_ANCHOR[section] ? GUIDE_ANCHOR[section] : '');
        link.target = '_blank';
        link.rel = 'noopener';
        return link;
    }

    function textField(labelText, value, type, onInput) {
        const wrapper = node('div', 'field row');
        const label = node('label', 'homey-form-label', labelText);
        wrapper.appendChild(label);

        const input = node('input', 'homey-form-input');
        input.type = type === 'password' ? 'password' : 'text';
        input.value = value || '';
        input.addEventListener('input', () => onInput(input.value));

        if (type === 'password') {
            const holder = node('div', 'password-wrapper');
            holder.appendChild(input);
            const toggle = node('button', 'toggle-password');
            toggle.type = 'button';
            toggle.innerHTML = EYE_ICONS;
            toggle.addEventListener('click', () => {
                const hidden = input.type === 'password';
                input.type = hidden ? 'text' : 'password';
                toggle.querySelector('.eye-icon').style.display = hidden ? 'none' : '';
                toggle.querySelector('.eye-off-icon').style.display = hidden ? '' : 'none';
            });
            holder.appendChild(toggle);
            wrapper.appendChild(holder);
        } else {
            wrapper.appendChild(input);
        }

        return wrapper;
    }

    function choiceRow(connection) {
        const row = node('label', 'wizard-choice');
        const input = node('input', 'wizard-choice-input');
        input.type = 'checkbox';
        input.checked = !!state.selected[connection];
        input.addEventListener('change', () => {
            state.selected[connection] = input.checked;
            row.className = input.checked ? 'wizard-choice selected' : 'wizard-choice';
        });
        if (input.checked) row.className = 'wizard-choice selected';

        const body = node('div', 'wizard-choice-body');
        body.appendChild(node('span', 'wizard-choice-title', t('choose.' + connection)));
        body.appendChild(node('span', 'wizard-choice-desc', t('choose.' + connection + 'desc')));

        row.appendChild(input);
        row.appendChild(body);
        return row;
    }

    function instructionList(connection) {
        const list = node('ol', 'wizard-steps');
        for (let i = 1; i <= INSTRUCTION_STEPS[connection]; i++) {
            const text = t(connection + '.s' + i).replace('__ip__', state.ip || '<ip>');
            list.appendChild(node('li', null, text));
        }
        return list;
    }

    function clearTestResult() {
        if (!testResultElement) return;
        testResultElement.className = 'wizard-test-result';
        testResultElement.textContent = '';
    }

    function testBlock(connection) {
        const holder = node('div', 'wizard-test');
        const button = node('button', 'homey-button-primary-full wizard-test-button', t('test.run'));
        button.type = 'button';
        const result = node('div', 'wizard-test-result');

        if (state.tested[connection] === true) {
            result.className = 'wizard-test-result ok';
            result.textContent = t('test.ok');
        } else if (state.tested[connection] === false) {
            result.className = 'wizard-test-result fail';
            result.textContent = t('test.fail');
        }

        button.addEventListener('click', () => {
            const error = validateStep(connection);
            if (error) {
                result.className = 'wizard-test-result fail';
                result.textContent = error;
                return;
            }

            button.disabled = true;
            result.className = 'wizard-test-result busy';
            result.textContent = t('test.busy');

            runTest(connection)
                .then((success) => {
                    state.tested[connection] = success;
                    result.className = 'wizard-test-result ' + (success ? 'ok' : 'fail');
                    result.textContent = success ? t('test.ok') : t('test.fail');
                })
                .catch(() => {
                    state.tested[connection] = false;
                    result.className = 'wizard-test-result fail';
                    result.textContent = t('test.fail');
                })
                .then(() => {
                    button.disabled = false;
                });
        });

        holder.appendChild(button);
        holder.appendChild(result);
        testResultElement = result;
        return holder;
    }

    function runTest(connection) {
        if (connection === 'v1') {
            return callApi('POST', '/test', {
                host: state.ip, port: state.v1port, user: state.username, pass: state.password,
            }).then((response) => !!response && response.status === 'success');
        }
        if (connection === 'v2') {
            return callApi('POST', '/testV2ApiKey', {
                host: state.ip, port: state.v2port, protectV2ApiKey: state.v2key,
            }).then((response) => !!response && response.status === 'success');
        }
        return callApi('POST', '/testAccessApiKey', {
            host: state.ip, port: state.accessport, accessApiKey: state.accesskey,
        }).then((response) => !!response && response.status === 'success');
    }

    // ---------------------------------------------------------------- steps

    function renderWelcome(body) {
        body.appendChild(node('h3', 'wizard-step-title', t('welcome.title')));
        body.appendChild(node('p', null, t('welcome.body')));
        body.appendChild(guideLink());
    }

    function renderChoose(body) {
        body.appendChild(node('h3', 'wizard-step-title', t('choose.title')));
        body.appendChild(node('p', null, t('choose.body')));
        CONNECTIONS.forEach((connection) => body.appendChild(choiceRow(connection)));
    }

    function renderServer(body) {
        body.appendChild(node('h3', 'wizard-step-title', t('server.title')));
        body.appendChild(node('p', null, t('server.body')));
        body.appendChild(textField(t('server.ip'), state.ip, 'text', (value) => {
            state.ip = value.trim();
        }));

        const toggleRow = node('label', 'homey-form-checkbox wizard-advanced');
        const toggle = node('input', 'homey-form-checkbox-input');
        toggle.type = 'checkbox';
        toggle.checked = state.advanced;
        toggleRow.appendChild(toggle);
        toggleRow.appendChild(node('span', 'homey-form-checkbox-checkmark'));
        toggleRow.appendChild(node('span', 'homey-form-checkbox-text', t('server.advanced')));
        body.appendChild(toggleRow);

        const ports = node('div', 'wizard-ports');
        ports.style.display = state.advanced ? 'block' : 'none';
        if (state.selected.v1) {
            ports.appendChild(textField(t('server.v1port'), state.v1port, 'text', (value) => {
                state.v1port = value.trim();
            }));
        }
        if (state.selected.v2) {
            ports.appendChild(textField(t('server.v2port'), state.v2port, 'text', (value) => {
                state.v2port = value.trim();
            }));
        }
        if (state.selected.access) {
            ports.appendChild(textField(t('server.accessport'), state.accessport, 'text', (value) => {
                state.accessport = value.trim();
            }));
        }
        toggle.addEventListener('change', () => {
            state.advanced = toggle.checked;
            ports.style.display = toggle.checked ? 'block' : 'none';
        });
        body.appendChild(ports);
    }

    function renderConnection(body, connection) {
        body.appendChild(node('h3', 'wizard-step-title', t(connection + '.title')));
        body.appendChild(node('p', null, t(connection + '.intro')));
        body.appendChild(instructionList(connection));
        body.appendChild(guideLink(connection));

        const fields = node('fieldset', 'homey-form-fieldset');
        if (connection === 'v1') {
            fields.appendChild(textField(homey.__('settings.username'), state.username, 'text', (value) => {
                state.username = value;
                state.tested.v1 = null;
                clearTestResult();
            }));
            fields.appendChild(textField(homey.__('settings.password'), state.password, 'password', (value) => {
                state.password = value;
                state.tested.v1 = null;
                clearTestResult();
            }));
        } else if (connection === 'v2') {
            fields.appendChild(textField(homey.__('settings.protectV2ApiKey'), state.v2key, 'password', (value) => {
                state.v2key = value.trim();
                state.tested.v2 = null;
                clearTestResult();
            }));

            const cloudToggleRow = node('label', 'homey-form-checkbox wizard-advanced');
            const cloudToggle = node('input', 'homey-form-checkbox-input');
            cloudToggle.type = 'checkbox';
            cloudToggle.checked = !!state.cloudEnabled;
            cloudToggleRow.appendChild(cloudToggle);
            cloudToggleRow.appendChild(node('span', 'homey-form-checkbox-checkmark'));
            cloudToggleRow.appendChild(node('span', 'homey-form-checkbox-text', t('v2.cloud')));
            fields.appendChild(cloudToggleRow);

            const cloudConsoleIdField = textField(t('v2.consoleId'), state.cloudConsoleId, 'text', (value) => {
                state.cloudConsoleId = value.trim();
                state.tested.v2 = null;
                clearTestResult();
            });
            cloudConsoleIdField.style.display = state.cloudEnabled ? '' : 'none';
            fields.appendChild(cloudConsoleIdField);

            cloudToggle.addEventListener('change', () => {
                state.cloudEnabled = cloudToggle.checked;
                state.tested.v2 = null;
                clearTestResult();
                cloudConsoleIdField.style.display = cloudToggle.checked ? '' : 'none';
            });
        } else {
            fields.appendChild(textField(homey.__('settings.accessApiKey'), state.accesskey, 'password', (value) => {
                state.accesskey = value.trim();
                state.tested.access = null;
                clearTestResult();
            }));
        }
        body.appendChild(fields);
        body.appendChild(testBlock(connection));
    }

    function renderSummary(body) {
        body.appendChild(node('h3', 'wizard-step-title', t('summary.title')));
        body.appendChild(node('p', null, t('summary.body')));

        const list = node('ul', 'wizard-summary');
        CONNECTIONS.filter((connection) => state.selected[connection]).forEach((connection) => {
            const status = state.tested[connection] === true ? t('summary.tested') : t('summary.untested');
            list.appendChild(node('li', null, t('choose.' + connection) + ' — ' + status));
        });
        body.appendChild(list);
    }

    function validateStep(step) {
        if (step === 'choose') {
            const any = CONNECTIONS.some((connection) => state.selected[connection]);
            return any ? null : t('choose.error');
        }
        if (step === 'server') {
            return state.ip ? null : t('server.error');
        }
        if (step === 'v1') {
            return (state.username && state.password) ? null : t('v1.error');
        }
        if (step === 'v2') {
            if (!state.v2key) return t('v2.error');
            if (state.cloudEnabled && !state.cloudConsoleId) return t('v2.cloudError');
            return null;
        }
        if (step === 'access') {
            return state.accesskey ? null : t('access.error');
        }
        return null;
    }

    function buildSteps() {
        steps = ['welcome', 'choose', 'server'];
        CONNECTIONS.forEach((connection) => {
            if (state.selected[connection]) steps.push(connection);
        });
        steps.push('summary');
    }

    function render() {
        const step = steps[stepIndex];
        testResultElement = null;
        const body = el('wizard_body');
        const nav = el('wizard_nav');
        body.innerHTML = '';
        nav.innerHTML = '';
        el('wizard_title').textContent = t('title');
        el('wizard_progress').textContent = t('progress') + ' ' + (stepIndex + 1) + '/' + steps.length;

        if (step === 'welcome') renderWelcome(body);
        else if (step === 'choose') renderChoose(body);
        else if (step === 'server') renderServer(body);
        else if (step === 'summary') renderSummary(body);
        else renderConnection(body, step);

        const error = node('div', 'wizard-error');
        error.style.display = 'none';
        body.appendChild(error);

        if (stepIndex > 0) {
            const back = node('button', 'wizard-button', t('back'));
            back.type = 'button';
            back.addEventListener('click', () => {
                stepIndex -= 1;
                render();
            });
            nav.appendChild(back);
        }

        const isLast = step === 'summary';
        const forward = node('button', 'wizard-button primary', isLast ? t('summary.finish') : (stepIndex === 0 ? t('start') : t('next')));
        forward.type = 'button';
        forward.addEventListener('click', () => {
            const message = validateStep(step);
            if (message) {
                error.textContent = message;
                error.style.display = 'block';
                return;
            }
            if (isLast) {
                forward.disabled = true;
                save()
                    .then(() => {
                        homey.alert(t('summary.saved'), 'info');
                        close();
                    })
                    .catch((saveError) => {
                        forward.disabled = false;
                        homey.alert(saveError);
                    });
                return;
            }
            if (step === 'choose') buildSteps();
            stepIndex += 1;
            render();
        });
        nav.appendChild(forward);

        const dismiss = node('button', 'wizard-button ghost', state.completed ? t('cancel') : t('skip'));
        dismiss.type = 'button';
        dismiss.addEventListener('click', () => {
            if (state.completed) {
                close();
                return;
            }
            setSetting('ufp:wizard', {completed: true, skipped: true, version: 1})
                .catch(() => null)
                .then(close);
        });
        nav.appendChild(dismiss);
    }

    // ---------------------------------------------------------------- persistence

    function save() {
        const writes = [];

        if (state.selected.v1) {
            writes.push(setSetting('ufp:nvrip', state.ip));
            writes.push(setSetting('ufp:nvrport', state.v1port || DEFAULT_PORT.v1));
            writes.push(setSetting('ufp:credentials', {username: state.username, password: state.password}));
        }
        if (state.selected.v2) {
            writes.push(setSetting('ufp:v2nvr', {nvrip: state.ip, nvrport: state.v2port || DEFAULT_PORT.v2}));
            writes.push(setSetting('ufp:protectCloudApi', {enabled: !!state.cloudEnabled, consoleId: state.cloudConsoleId || ''}));
        }
        if (state.selected.access) {
            writes.push(setSetting('ufp:accessnvr', {nvrip: state.ip, nvrport: state.accessport || DEFAULT_PORT.access}));
        }

        // ufp:tokens holds both API keys, so merge into the stored value instead of replacing it
        const tokenPatch = {};
        if (state.selected.v2) tokenPatch.protectV2ApiKey = state.v2key;
        if (state.selected.access) tokenPatch.accessApiKey = state.accesskey;

        return Promise.all(writes)
            .then(() => {
                if (!Object.keys(tokenPatch).length) return null;
                return getSetting('ufp:tokens')
                    .then((tokens) => setSetting('ufp:tokens', Object.assign({}, tokens, tokenPatch)));
            })
            .then(() => setSetting('ufp:wizard', {
                completed: true, skipped: false, version: 1, completedAt: new Date().toISOString(),
            }));
    }

    function loadState() {
        return Promise.all([
            getSetting('ufp:nvrip'),
            getSetting('ufp:nvrport'),
            getSetting('ufp:credentials'),
            getSetting('ufp:v2nvr'),
            getSetting('ufp:protectCloudApi'),
            getSetting('ufp:accessnvr'),
            getSetting('ufp:tokens'),
            getSetting('ufp:wizard'),
        ]).then((values) => {
            const nvrip = values[0];
            const nvrport = values[1];
            const credentials = values[2] || {};
            const v2nvr = values[3] || {};
            const protectCloud = values[4] || {};
            const accessnvr = values[5] || {};
            const tokens = values[6] || {};
            const wizard = values[7] || {};

            state = {
                ip: nvrip || v2nvr.nvrip || accessnvr.nvrip || '',
                v1port: nvrport || DEFAULT_PORT.v1,
                v2port: v2nvr.nvrport || DEFAULT_PORT.v2,
                accessport: accessnvr.nvrport || DEFAULT_PORT.access,
                advanced: false,
                username: credentials.username || '',
                password: credentials.password || '',
                v2key: tokens.protectV2ApiKey || '',
                accesskey: tokens.accessApiKey || '',
                cloudEnabled: !!protectCloud.enabled,
                cloudConsoleId: protectCloud.consoleId || '',
                selected: {
                    v1: !!(credentials.username && credentials.password),
                    v2: !!tokens.protectV2ApiKey,
                    access: !!tokens.accessApiKey,
                },
                tested: {v1: null, v2: null, access: null},
                completed: !!wizard.completed,
            };

            state.configured = state.selected.v1 || state.selected.v2 || state.selected.access;
            if (!state.configured) {
                state.selected.v2 = true;
            }
            return state;
        });
    }

    // ---------------------------------------------------------------- visibility

    function setTabsVisible(visible) {
        const tabs = document.getElementsByClassName('tab');
        for (let i = 0; i < tabs.length; i++) {
            tabs[i].style.display = visible ? '' : 'none';
        }
        if (!visible) {
            const contents = document.getElementsByClassName('tabcontent');
            for (let i = 0; i < contents.length; i++) {
                contents[i].style.display = 'none';
            }
        }
    }

    function show() {
        open = true;
        stepIndex = 0;
        buildSteps();
        setTabsVisible(false);
        el('wizard').style.display = 'block';
        render();
    }

    function close() {
        open = false;
        el('wizard').style.display = 'none';
        setTabsVisible(true);
        const defaultTab = el('defaultOpen');
        if (defaultTab) defaultTab.click();
        if (typeof onClose === 'function') onClose();
    }

    function init(homeyInstance, options) {
        homey = homeyInstance;
        onClose = options && options.onClose;

        return loadState().then(() => {
            if (!state.configured && !state.completed) {
                show();
            }
            return state;
        });
    }

    function restart() {
        return loadState().then(() => {
            show();
            return state;
        });
    }

    window.UfpWizard = {
        init: init,
        restart: restart,
        isOpen: function () {
            return open;
        },
    };
}());
