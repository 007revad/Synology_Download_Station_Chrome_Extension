// MV3 Service Worker - jQuery shim with proper SW lifecycle handling
console.log('[ajax-shim] LOADING...');

const jQueryShim = function(selector) {
    // Return an object that mimics jQuery behavior
    return {
        find: function(sel) {
            return jQueryShim(sel);
        },
        text: function() {
            return '';
        },
        next: function() {
            return jQueryShim();
        }
    };
};

// Add jQuery static methods to the function
jQueryShim.extend = function(target, source) {
    if (!source) return target;
    for (let key in source) {
        if (source.hasOwnProperty(key)) {
            target[key] = source[key];
        }
    }
    return target;
};

jQueryShim.ajax = function(options) {
    let doneCallback, failCallback;
    let xhrRef = null;
    
    const promise = new Promise((resolve, reject) => {
        let method = options.type || 'GET';
        let url = options.url;
        let body = null;
        
        // Handle data serialization
        if (options.data) {
            if (typeof options.data === 'string') {
                if (method === 'GET') {
                    url = url + (url.indexOf('?') === -1 ? '?' : '&') + options.data;
                } else {
                    body = options.data;
                }
            } else if (typeof options.data === 'object') {
                const params = new URLSearchParams();
                for (const [key, value] of Object.entries(options.data)) {
                    if (value !== null && value !== undefined) {
                        params.append(key, value);
                    }
                }
                if (method === 'GET') {
                    url = url + (url.indexOf('?') === -1 ? '?' : '&') + params.toString();
                } else {
                    body = params.toString();
                }
            }
        }
        
        const fetchOptions = {
            method: method,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...options.headers
            }
        };
        
        // Add credentials if provided
        if (options.username && options.password) {
            fetchOptions.headers['Authorization'] = 'Basic ' + btoa(options.username + ':' + options.password);
        }
        
        if (body && method !== 'GET') {
            fetchOptions.body = body;
        }
        
        // Create a mock XHR object for compatibility
        const mockXhr = {
            responseText: null,
            status: 0,
            headers: {},
            getResponseHeader: function(header) {
                return this.headers[header.toLowerCase()] || null;
            }
        };
        xhrRef = mockXhr;
        
        const controller = new AbortController();
        const timeout = options.timeout || 20000;
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        fetchOptions.signal = controller.signal;
        
        fetch(url, fetchOptions)
            .then(response => {
                clearTimeout(timeoutId);
                mockXhr.status = response.status;
                
                // Store headers
                response.headers.forEach((value, name) => {
                    mockXhr.headers[name.toLowerCase()] = value;
                });
                
                if (!response.ok && response.status !== 0) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.text();
            })
            .then(data => {
                mockXhr.responseText = data;
                let parsed = data;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    // Keep as string if not JSON
                }
                
                if (options.success) {
                    options.success(parsed);
                }
                if (doneCallback) {
                    doneCallback(parsed);
                }
                resolve(parsed);
            })
            .catch(error => {
                clearTimeout(timeoutId);
                console.error('[SW] AJAX Error:', error.message, 'URL:', url);
                
                if (options.error) {
                    options.error(error);
                }
                if (failCallback) {
                    failCallback(error);
                }
                reject(error);
            });
    });
    
    // Return jQuery-compatible object
    return {
        done: function(cb) {
            doneCallback = cb;
            promise.then(cb).catch(() => {});
            return this;
        },
        fail: function(cb) {
            failCallback = cb;
            promise.catch(cb);
            return this;
        },
        then: promise.then.bind(promise),
        catch: promise.catch.bind(promise),
        get responseText() {
            return xhrRef ? xhrRef.responseText : null;
        },
        getResponseHeader: function(header) {
            return xhrRef ? xhrRef.getResponseHeader(header) : null;
        }
    };
};

jQueryShim.trim = (str) => str ? str.trim() : '';

jQueryShim.param = function(obj) {
    if (!obj) return '';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined) {
            params.append(key, value);
        }
    }
    return params.toString();
};

jQueryShim.each = function(obj, callback) {
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            callback.call(obj[i], i, obj[i]);
        }
    } else if (typeof obj === 'object') {
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                callback.call(obj[key], key, obj[key]);
            }
        }
    }
    return obj;
};

self.$ = globalThis.$ = jQueryShim;
console.log('[ajax-shim] $ assigned, typeof $:', typeof $, 'typeof $.each:', typeof $.each);
if (typeof $.each !== 'function') {
    console.error('[ajax-shim] ERROR: $.each is not a function!');
} else {
    console.log('[ajax-shim] SUCCESS: $.each is available');
}
