(function () {
    'use strict';
    var GUARD = '__lampac_multi_fix_v2';
    if (window[GUARD]) return;
    window[GUARD] = true;
    var handlerCounter = 0;
    function applyPatch() {
        var _origFollow = Lampa.Listener.follow;
        Lampa.Listener.follow = function (type, fn) {
            if (type !== 'full') {
                return _origFollow.apply(this, arguments);
            }
            var handlerId = ++handlerCounter;
            var processedNodes = new WeakSet();
            var wrappedHandler = function (e) {
                if (!e || e.type !== 'complite') {
                    return fn.call(this, e);
                }
                var anchorNode = null;
                try {
                    anchorNode = e.object.activity.render().find('.view--torrent')[0];
                } catch (_) {}
                if (!anchorNode) {
                    try { anchorNode = e.object.activity.render()[0]; } catch (_) {}
                }
                if (anchorNode && processedNodes.has(anchorNode)) {
                    return fn.call(this, e);
                }
                var _origFind = $.fn.find;
                $.fn.find = function (selector) {
                    if (typeof selector === 'string' && selector.trim() === '.lampac--button') {
                        return $([]);
                    }
                    return _origFind.apply(this, arguments);
                };
                try {
                    fn.call(this, e);
                } finally {
                    $.fn.find = _origFind;
                    if (anchorNode) {
                        processedNodes.add(anchorNode);
                    }
                }
            };
            return _origFollow.call(this, 'full', wrappedHandler);
        };
    }
    if (window.Lampa && window.Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
        applyPatch();
    } else {
        var _waitTimer = setInterval(function () {
            if (window.Lampa && window.Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
                clearInterval(_waitTimer);
                applyPatch();
            }
        }, 50);
    }
})();
