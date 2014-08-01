/**
 * @copyright   2010-2014, The Titon Project
 * @license     http://opensource.org/licenses/BSD-3-Clause
 * @link        http://titon.io
 */

'use strict';

// Check if transitions exist
var hasTransition = (function() {
    var prefixes = 'transition WebkitTransition MozTransition OTransition msTransition'.split(' '),
        style = document.createElement('div').style;

    for (var i = 0; i < prefixes.length; i++) {
        if (prefixes[i] in style) {
            return prefixes[i];
        }
    }

    return false;
})();

// Toolkit namespace
var Toolkit = {

    /** Current version */
    version: '%version%',

    /** Build date hash */
    build: '%build%',

    /** Vendor namespace */
    vendor: '',

    /** ARIA support */
    aria: true,

    /** Localization messages */
    messages: {
        loading: 'Loading...',
        error: 'An error has occurred!'
    },

    /** Does the browser support transitions? */
    hasTransition: hasTransition,

    /** Event name for transition end */
    transitionEnd: (function() {
        var eventMap = {
            WebkitTransition: 'webkitTransitionEnd',
            OTransition: 'oTransitionEnd otransitionend'
        };

        return eventMap[hasTransition] || 'transitionend';
    })(),

    /** Detect touch devices */
    isTouch: !!(('ontouchstart' in window) || (window.DocumentTouch && document instanceof DocumentTouch)),

    /** Detect retina displays */
    isRetina: (window.devicePixelRatio > 1),

    /**
     * Convert a string value to a scalar equivalent.
     * This method is used to convert data attribute values into option values.
     *
     * @param {*} value
     * @returns {*}
     */
    autobox: function(value) {
        if (typeOf(value) === 'null') {
            value = null;
        } else if (value === 'true') {
            value = true;
        } else if (value === 'false') {
            value = false;
        } else if (isNaN(value)) {
            value = String.from(value);
        } else {
            value = Number.from(value);
        }

        return value;
    },

    /**
     * Creates a new component by extending the Element(s) prototype and defines a method
     * that initializes a component. The component is only initialized if one has not been already.
     * Components are either defined per element, or on a collection of elements.
     *
     * @param {String} component
     * @param {Function} callback
     * @param {bool} collection
     */
    create: function(component, callback, collection) {
        var name = component,
            key = '$' + name;

        // Prefix with toolkit to avoid collisions
        if (collection) {
            if (Elements.prototype[name]) {
                name = 'toolkit' + name.charAt(0).toUpperCase() + name.slice(1);
            }

            Elements.implement(name, function() {
                var instance = callback.apply(this, arguments);

                return this.each(function(el) {
                    if (!el[key]) {
                        el[key] = instance;
                    }
                });
            });

        } else {
            if (Element.prototype[name]) {
                name = 'toolkit' + name.charAt(0).toUpperCase() + name.slice(1);
            }

            Element.implement(name, function() {
                if (!this[key]) {
                    this[key] = callback.apply(this, arguments);
                }

                return this;
            });
        }
    }

};

// Make it available
window.Toolkit = Toolkit;

// Dereference these variables to lower the filesize
var vendor = Toolkit.vendor;

/**
 * Prototype overrides.
 */
Element.implement({

    /**
     * Fetch the component instance from the element.
     *
     * @param {String} component
     * @param {String} method
     * @param {Array} [args]
     * @returns {Function}
     */
    toolkit: function(component, method, args) {
        var instance = this['$' + component];

        if (!instance) {
            return null;
        }

        // Trigger a method on the instance of method is defined
        if (method && instance[method]) {
            instance[method].apply(instance, Array.from(args));
        }

        return instance;
    },

    /**
     * Reveal the element by applying the show class.
     * Should be used to trigger transitions and animations.
     *
     * @returns {Element}
     */
    reveal: function() {
        return this.swapClass('hide', 'show').aria('hidden', false);
    },

    /**
     * Conceal the element by applying the hide class.
     * Should be used to trigger transitions and animations.
     *
     * @returns {Element}
     */
    conceal: function() {
        return this.swapClass('show', 'hide').aria('hidden', true);
    },

    /**
     * Used for animations. Do not conflict with isVisible() or isHidden().
     *
     * @returns {bool}
     */
    isShown: function() {
        return (this.getStyle('visibility') !== 'hidden');
    },

    /**
     * A multi-purpose getter and setter for ARIA attributes.
     * Will prefix attribute names and cast values correctly.
     *
     * @param {String} key
     * @param {*} value
     * @returns {Element}
     */
    aria: function(key, value) {
        if (!Toolkit.aria) {
            return this;
        }

        if (value === true) {
            value = 'true';
        } else if (value === false) {
            value = 'false';
        }

        return this.set('aria-' + key, value);
    }.overloadSetter(),

    /**
     * Position the element relative to another element in the document, or to the mouse cursor.
     * Determine the offsets through the `relativeTo` argument, which can be an event, or a jQuery element.
     * Re-position the element if its target coordinates fall outside of the viewport.
     * Optionally account for mouse location and base offset coordinates.
     *
     * @param {String} position
     * @param {DOMEvent|Element} relativeTo
     * @param {Object} baseOffset
     * @param {bool} isMouse
     * @returns {Element}
     */
    positionTo: function(position, relativeTo, baseOffset, isMouse) {
        var offset = baseOffset || { left: 0, top: 0 },
            relHeight = 0,
            relWidth = 0,
            eSize = this.getDimensions({
                computeSize: true,
                styles: ['padding', 'border', 'margin']
            });

        // If an event is used, position it near the mouse
        if (typeOf(relativeTo) === 'domevent') {
            offset.left += relativeTo.page.x;
            offset.top += relativeTo.page.y;

        // Else position it near the element
        } else {
            var relOffset = relativeTo.getPosition(),
                newPosition = position,
                wSize = window.getSize(),
                wsTop = window.getScroll().top;

            offset.left += relOffset.x;
            offset.top += relOffset.y;
            relHeight = relativeTo.getHeight();
            relWidth = relativeTo.getWidth();

            // Re-position element if outside the viewport
            if ((relOffset.top - eSize.totalHeight - wsTop) < 0) {
                newPosition = newPosition.replace('top', 'bottom');

            } else if ((relOffset.top + relHeight + eSize.totalHeight) > wSize.y) {
                newPosition = newPosition.replace('bottom', 'top');
            }

            if ((relOffset.left - eSize.totalWidth) < 0) {
                newPosition = newPosition.replace('left', 'right');

            } else if ((relOffset.left + relWidth + eSize.totalWidth) > wSize.x) {
                newPosition = newPosition.replace('right', 'left');
            }

            if (position !== newPosition) {
                this.removeClass(position)
                    .addClass(newPosition)
                    .set('data-new-position', newPosition);

                position = newPosition;
            }
        }

        // Shift around based on edge positioning
        var parts = position.split('-'),
            edge = { y: parts[0], x: parts[1] };

        // Shift around based on edge positioning
        if (edge.y === 'top') {
            offset.top -= eSize.totalHeight;
        } else if (edge.y === 'bottom') {
            offset.top += relHeight;
        } else if (edge.y === 'center') {
            offset.top -= Math.round((eSize.totalHeight / 2) - (relHeight / 2));
        }

        if (edge.x === 'left') {
            offset.left -= eSize.totalWidth;
        } else if (edge.x === 'right') {
            offset.left += relWidth;
        } else if (edge.x === 'center') {
            offset.left -= Math.round((eSize.totalWidth / 2) - (relWidth / 2));
        }

        // Increase the offset in case we are following the mouse cursor
        // We need to leave some padding for the literal cursor to not cause a flicker
        if (isMouse) {
            if (edge.y === 'center') {
                if (edge.x === 'left') {
                    offset.left -= 15;
                } else if (edge.x === 'right') {
                    offset.left += 15;
                }
            }

            if (edge.x === 'center') {
                if (edge.y === 'top') {
                    offset.top -= 10;
                } else if (edge.y === 'bottom') {
                    offset.top += 20;
                }
            }
        }

        return this.setStyles(offset);
    }

});

Array.implement({

    /**
     * Split an array into multiple chunked arrays.
     *
     * @param {Number} size
     * @returns {Array}
     */
    chunk: function(size) {
        var array = this;

        return [].concat.apply([], array.map(function(elem, i) {
            return (i % size) ? [] : [ array.slice(i, i + size) ];
        }));
    }

});

Number.implement({

    /**
     * Bound a number between a min and max range.
     *
     * @param {Number} max
     * @param {Number} min
     * @returns {Number}
     */
    bound: function(max, min) {
        var value = this;

        min = min || 0;

        if (value >= max) {
            value = 0;
        } else if (value < min) {
            value = max - 1;
        }

        return value;
    }

});

Function.implement({

    /**
     * Delays the execution of a function till the duration has completed.
     *
     * @param {Number} [threshold]
     * @param {bool} [immediate]
     * @returns {Function}
     */
    debounce: function(threshold, immediate) {
        var timeout, func = this;

        return function() {
            var context = this, args = arguments;

            clearTimeout(timeout);

            timeout = setTimeout(function() {
                timeout = null;

                if (!immediate) {
                    func.apply(context, args);
                }
            }, threshold || 150);

            if (immediate && !timeout)  {
                func.apply(context, args);
            }
        };
    }

});

/**
 * An event that allows the clicking of the document to trigger a callback.
 * However, will only trigger if the element clicked is not in the exclude list or a child of.
 * Useful for closing dropdowns and menus.
 *
 * Based on and credited to http://benalman.com/news/2010/03/jquery-special-events/
 *
 * @returns {Object}
 */
Element.Events.clickout = (function() {
    var elements = new Elements();

    function isOut(e) {
        var trigger = true;

        elements.each(function(el) {
            if (trigger) {
                trigger = (el !== e.target && el.getElements(e.target).length === 0);
            }
        });

        return trigger;
    }

    function clickOut(e) {
        if (isOut(e)) {
            elements.fireEvent('clickout', [e.target]);
        }
    }

    return {
        base: 'click',
        condition: isOut,
        onAdd: function() {
            elements.push(this);

            if (elements.length === 1) {
                document.addEvent('click', clickOut);
            }
        },
        onRemove: function() {
            elements.pop(this);

            if (elements.length === 0) {
                document.removeEvent('click', clickOut);
            }
        }
    };
})();

/**
 * Override the default HTML setter and allow element nodes to be used.
 */
Element.Properties.html.set = function(html) {
    var type = typeOf(html);

    // If we use get('html') it will only get the inner HTML
    // This approach will append the element itself
    if (type === 'element') {
        this.innerHTML = '';
        this.appendChild(html);

        return this;
    }

    if (type === 'string' && html.match(/^#[a-z0-9_\-\.:]+$/i)) {
        html = document.getElement(html).get('html');

    } else if (type === 'array') {
        html = html.join('');
    }

    this.innerHTML = html;

    return this;
};

// Enable transitionend events
Element.NativeEvents.transitionend = 2;