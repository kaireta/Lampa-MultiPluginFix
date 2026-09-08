/**
 * lampac-multi-fix.js
 *
 * Исправляет конфликт между несколькими плагинами на базе Lampac
 * (например, Alpac + Online Cinema), когда оба установлены одновременно.
 *
 * ПРИЧИНА КОНФЛИКТА:
 *   Оба плагина добавляют кнопку с одинаковым CSS-классом `.lampac--button`
 *   и перед добавлением проверяют:
 *
 *       if (render.find('.lampac--button').length) return;   // ← проблема
 *
 *   Плагин, загрузившийся первым, добавляет кнопку.
 *   Плагин, загрузившийся вторым, видит чужую кнопку и выходит — своей не добавляет.
 *
 * КАК РАБОТАЕТ ИСПРАВЛЕНИЕ:
 *   Патч перехватывает Lampa.Listener.follow для события 'full'.
 *   Каждый зарегистрированный обработчик оборачивается так, что при его
 *   вызове jQuery `.find('.lampac--button')` временно возвращает пустой
 *   результат → защита не срабатывает → каждый плагин добавляет свою кнопку.
 *
 *   Чтобы один плагин не добавлял кнопку дважды при повторных событиях
 *   (например, открытие того же фильма снова), используется WeakSet —
 *   он запоминает, для каких DOM-узлов обработчик уже сработал.
 *
 * ДОЛГОВЕЧНОСТЬ:
 *   ✓ Не зависит от порядка загрузки других плагинов
 *   ✓ Не модифицирует и не перезаписывает сами плагины
 *   ✓ Использует только стабильное API: Lampa.Listener.follow и $.fn.find
 *   ✓ Безопасно восстанавливает $.fn.find даже при исключении (блок finally)
 *   ✓ WeakSet — нет утечек памяти при уничтожении DOM-узлов
 *   ✓ Идемпотентен: повторная загрузка не создаёт двойной патч
 */

(function () {
    'use strict';

    // ── Защита от двойной загрузки ──────────────────────────────────────────
    var GUARD = '__lampac_multi_fix_v2';
    if (window[GUARD]) return;
    window[GUARD] = true;

    // ── Счётчик для уникальных ID обработчиков ──────────────────────────────
    var handlerCounter = 0;

    /**
     * Патчит Lampa.Listener.follow.
     * Вызывается как только Lampa.Listener доступен.
     */
    function applyPatch() {
        var _origFollow = Lampa.Listener.follow;

        Lampa.Listener.follow = function (type, fn) {
            // Нас интересует только событие 'full' — именно оно используется
            // Lampac-плагинами для добавления кнопки на карточке фильма.
            if (type !== 'full') {
                return _origFollow.apply(this, arguments);
            }

            // Уникальный идентификатор этого конкретного обработчика
            var handlerId = ++handlerCounter;

            // WeakSet: DOM-узлы, для которых ЭТОТ обработчик уже выполнился.
            // Когда DOM-узел удаляется, запись автоматически исчезает из WeakSet
            // — нет утечек памяти.
            var processedNodes = new WeakSet();

            var wrappedHandler = function (e) {
                // Нас интересует только фаза 'complite' (карточка отрисована)
                if (!e || e.type !== 'complite') {
                    return fn.call(this, e);
                }

                // ── Определяем якорный DOM-узел ─────────────────────────────
                // Lampac-плагины вешают кнопку после .view--torrent; берём его
                // как ключ для отслеживания «уже обработано».
                var anchorNode = null;
                try {
                    anchorNode = e.object.activity.render().find('.view--torrent')[0];
                } catch (_) {}
                // Запасной вариант — корень рендера активности
                if (!anchorNode) {
                    try { anchorNode = e.object.activity.render()[0]; } catch (_) {}
                }

                // ── Если обработчик уже добавил кнопку на этот узел ─────────
                // Пускаем его без патча: он сам найдёт свою кнопку (`.lampac--button`
                // уже есть) и выйдет без изменений — это штатное поведение.
                if (anchorNode && processedNodes.has(anchorNode)) {
                    return fn.call(this, e);
                }

                // ── Временно скрываем .lampac--button из $.fn.find ───────────
                // Это заставит проверку `if (render.find('.lampac--button').length)`
                // вернуть 0, и обработчик добавит свою кнопку.
                var _origFind = $.fn.find;

                $.fn.find = function (selector) {
                    if (typeof selector === 'string' &&
                        selector.trim() === '.lampac--button') {
                        // Возвращаем пустой jQuery-объект — кнопок «нет»
                        return $([]);
                    }
                    return _origFind.apply(this, arguments);
                };

                try {
                    fn.call(this, e);
                } finally {
                    // ВСЕГДА восстанавливаем оригинальный find, даже при ошибке
                    $.fn.find = _origFind;

                    // Запоминаем, что для этого узла обработчик уже отработал
                    if (anchorNode) {
                        processedNodes.add(anchorNode);
                    }
                }
            };

            // Регистрируем обёрнутый обработчик в оригинальном Listener
            return _origFollow.call(this, 'full', wrappedHandler);
        };
    }

    // ── Активация патча ──────────────────────────────────────────────────────
    // Если Lampa уже доступна — патчим немедленно.
    // Иначе — ждём появления Lampa.Listener (опрос каждые 50 мс).
    if (window.Lampa &&
        window.Lampa.Listener &&
        typeof Lampa.Listener.follow === 'function') {
        applyPatch();
    } else {
        var _waitTimer = setInterval(function () {
            if (window.Lampa &&
                window.Lampa.Listener &&
                typeof Lampa.Listener.follow === 'function') {
                clearInterval(_waitTimer);
                applyPatch();
            }
        }, 50);
    }

})();
