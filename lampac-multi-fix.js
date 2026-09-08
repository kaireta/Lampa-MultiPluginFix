(function () {
    'use strict';

    var GUARD = '__lampac_multi_fix_v4';
    if (window[GUARD]) return;
    window[GUARD] = true;

    // Fix 1: window.lampac_plugin guard
    // Both plugins check: if (!window.lampac_plugin) startPlugin();
    // First plugin sets it true — second plugin skips startPlugin entirely.
    // Solution: property always returns undefined so both always run startPlugin.
    try {
        Object.defineProperty(window, 'lampac_plugin', {
            get: function () { return undefined; },
            set: function () {},
            configurable: true
        });
    } catch (e) {}

    // Fix 2: .lampac--button CSS guard
    // Both plugins check: if (render.find('.lampac--button').length) return;
    // First plugin adds its button — second sees it and exits without adding its own.
    // Solution: make $.fn.find('.lampac--button') always return empty so the guard
    // never triggers and both plugins always add their button.
    // Safe: button click handlers are attached directly to elements, not via
    // event delegation on '.lampac--button', so buttons work correctly.
    function applyFindPatch() {
        var _origFind = $.fn.find;
        $.fn.find = function (sel) {
            if (typeof sel === 'string' && sel.trim() === '.lampac--button') {
                return $([]);
            }
            return _origFind.apply(this, arguments);
        };
    }

    if (typeof $ !== 'undefined' && $.fn) {
        applyFindPatch();
    } else {
        var _t = setInterval(function () {
            if (typeof $ !== 'undefined' && $.fn) {
                clearInterval(_t);
                applyFindPatch();
            }
        }, 50);
    }

})();
