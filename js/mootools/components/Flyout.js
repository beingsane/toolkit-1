/**
 * @copyright   2010-2013, The Titon Project
 * @license     http://opensource.org/licenses/bsd-license.php
 * @link        http://titon.io
 */

Toolkit.Flyout = new Class({
    Extends: Toolkit.Component,
    Implements: [Timers],

    /** The current menu URL being displayed */
    current: null,

    /** Collection of menu elements */
    menus: {},

    /** Raw data response */
    data: [],

    /** Mapping of data indexed by URL */
    dataMap: {},

    /** Default options */
    options: {
        delegate: '.js-flyout',
        mode: 'hover',
        getUrl: 'href',
        xOffset: 0,
        yOffset: 0,
        showDelay: 350,
        hideDelay: 1000,
        itemLimit: 15,
        contentElement: '.flyout',
        template: '<div class="flyout"></div>'
    },

    /**
     * Initialize the component by fetching elements and binding events.
     *
     * @param {Elements} elements
     * @param {String} url
     * @param {Object} [options]
     */
    initialize: function(elements, url, options) {
        this.parent(options);
        this.nodes = elements;

        if (!url) {
            throw new Error('Flyout URL required to download sitemap JSON');
        }

        options = this.options;

        // Load data from the URL
        new Request.JSON({
            url: url,
            secure: true,
            onSuccess: this.load.bind(this)
        }).get();

        // Set timers
        this.addTimers({
            show: this.position,
            hide: this.onHide
        });

        // Initialize events
        if (options.mode === 'click') {
            this.events['click ' + options.delegate] = 'onShow';
        } else {
            this.events['mouseenter ' + options.delegate] = ['onShow', 'onEnter'];
            this.events['mouseleave ' + options.delegate] = 'onLeave';
        }

        this.enable();
        this.fireEvent('init');
    },

    /**
     * Hide the currently shown menu.
     *
     * @returns {Toolkit.Flyout}
     */
    hide: function() {
        this.clearTimers();

        // Must be called even if the menu is hidden
        this.node.removeClass('is-active');

        if (!this.current || !this.isVisible()) {
            return this;
        }

        this.menus[this.current].conceal();
        this.fireEvent('hide');

        // Reset last
        this.current = null;

        return this;
    },

    /**
     * Return true if the current menu exists and is visible.
     *
     * @returns {bool}
     */
    isVisible: function() {
        if (this.current && this.menus[this.current]) {
            this.element = this.menus[this.current];
        }

        return this.parent();
    },

    /**
     * Load the data into the class and save a mapping of it.
     *
     * @param {Object} data
     * @param {Number} [depth]
     * @returns {Toolkit.Flyout}
     */
    load: function(data, depth) {
        depth = depth || 0;

        // If root, store the data
        if (depth === 0) {
            this.data = data;
        }

        // Store the data indexed by URL
        if (data.url) {
            this.dataMap[data.url] = data;
        }

        if (data.children) {
            for (var i = 0, l = data.children.length; i < l; i++) {
                this.load(data.children[i], depth + 1);
            }
        }

        return this;
    },

    /**
     * Position the menu below the target node.
     *
     * @returns {Toolkit.Flyout}
     */
    position: function() {
        var target = this.current,
            options = this.options;

        if (!this.menus[target]) {
            return this;
        }

        var menu = this.menus[target],
            height = menu.getDimensions().height,
            coords = this.node.getCoordinates(),
            x = coords.left + options.xOffset,
            y = coords.top + options.yOffset + coords.height,
            windowScroll = window.getScrollSize();

        // If menu goes below half page, position it above
        if (y > (windowScroll.y / 2)) {
            y = coords.top - options.yOffset - height;
        }

        menu.setPosition({
            x: x,
            y: y
        }).reveal();

        this.fireEvent('show');

        return this;
    },

    /**
     * Show the menu below the node.
     *
     * @param {Element} node
     * @returns {Toolkit.Flyout}
     */
    show: function(node) {
        var target = this._getTarget(node);

        // When jumping from one node to another
        // Immediately hide the other menu and start the timer for the current one
        if (this.current && target !== this.current) {
            this.hide();
            this.startTimer('show', this.options.showDelay);
        }

        this.node = node;

        // Find the menu, else create it
        if (!this._getMenu()) {
            return this;
        }

        this.node.addClass('is-active');

        // Display immediately if click
        if (this.options.mode === 'click') {
            this.position();
        }

        return this;
    },

    /**
     * Build a nested list menu using the data object.
     *
     * @private
     * @param {Element} parent
     * @param {Object} data
     * @returns {Element}
     */
    _buildMenu: function(parent, data) {
        if (!data.children || !data.children.length) {
            return null;
        }

        var options = this.options,
            menu = this.parseTemplate(options.template),
            groups = [],
            ul,
            li,
            tag,
            target = options.contentElement,
            limit = options.itemLimit;

        menu.set('role', 'menu').aria('hidden', true);

        if (options.className) {
            menu.addClass(options.className);
        }

        if (parent === document.body) {
            menu.addClass('is-root');
        } else {
            menu.aria('expanded', false);
        }

        if (limit && data.children.length > limit) {
            groups = data.children.chunk(limit);
        } else {
            groups.push(data.children);
        }

        for (var g = 0, group; group = groups[g]; g++) {
            ul = new Element('ul');

            for (var i = 0, l = group.length, child; i < l; i++) {
                child = group[i];
                li = new Element('li');

                // Build tag
                if (child.url) {
                    tag = new Element('a', {
                        text: child.title,
                        href: child.url,
                        role: 'menuitem'
                    });

                    // Add icon
                    new Element('span').addClass(child.icon || 'caret-right').inject(tag, 'top');
                } else {
                    tag = new Element('span', {
                        text: child.title,
                        role: 'presentation'
                    });

                    li.addClass(Toolkit.vendor + 'flyout-heading');
                }

                if (child.attributes) {
                    tag.set(child.attributes);
                }

                // Build list
                if (child.className) {
                    li.addClass(child.className);
                }

                li.grab(tag).inject(ul);

                if (child.children && child.children.length) {
                    this._buildMenu(li, child);

                    li.addClass('has-children')
                        .aria('haspopup', true)
                        .addEvent('mouseenter', this.onPositionChild.bind(this, li))
                        .addEvent('mouseleave', this.onHideChild.bind(this, li));
                }
            }

            if (target) {
                if (target.substr(0, 1) === '.' && menu.hasClass(target.substr(1))) {
                    menu.grab(ul);
                } else {
                    menu.getElement(target).grab(ul);
                }
            } else {
                menu.grab(ul);
            }
        }

        menu.inject(parent);

        return menu;
    }.protect(),

    /**
     * Get the menu if it exists, else build it and set events.
     *
     * @private
     * @returns {Element}
     */
    _getMenu: function() {
        var target = this._getTarget();

        if (this.menus[target]) {
            this.current = target;

            return this.menus[target];
        }

        if (this.dataMap[target]) {
            var menu = this._buildMenu(document.body, this.dataMap[target]);

            if (!menu) {
                return null;
            }

            menu.conceal();

            if (this.options.mode !== 'click') {
                menu.addEvents({
                    mouseenter: function() {
                        this.clearTimer('hide');
                    }.bind(this),
                    mouseleave: function() {
                        this.startTimer('hide', this.options.hideDelay);
                    }.bind(this)
                });
            }

            this.current = target;
            this.menus[target] = menu;

            return this.menus[target];
        }

        return null;
    }.protect(),

    /**
     * Get the target URL to determine which menu to show.
     *
     * @private
     * @param {Element} node
     * @returns {String}
     */
    _getTarget: function(node) {
        node = node || this.node;

        return this.readValue(node, this.options.getUrl) || node.get('href');
    }.protect(),

    /**
     * Event handle when a mouse enters a node. Will show the menu after the timer.
     *
     * @private
     */
    onEnter: function() {
        this.clearTimer('hide').startTimer('show', this.options.showDelay);
    },

    /**
     * Event handler to hide the child menu after exiting parent li.
     *
     * @private
     * @param {Element} parent
     */
    onHideChild: function(parent) {
        parent.removeClass('is-open');
        parent.getChildren(this.options.contentElement)
            .removeProperty('style')
            .aria({
                expanded: false,
                hidden: true
            });

        this.fireEvent('hideChild', parent);
    },

    /**
     * Event handle when a mouse leaves a node. Will hide the menu after the timer.
     *
     * @private
     */
    onLeave: function() {
        this.clearTimer('show').startTimer('hide', this.options.showDelay);
    },

    /**
     * Event handler to position the child menu dependent on the position in the page.
     *
     * @private
     * @param {Element} parent
     */
    onPositionChild: function(parent) {
        var menu = parent.getElement(this.options.contentElement);

        if (!menu) {
            return;
        }

        menu.aria({
            expanded: true,
            hidden: false
        });

        // Alter width because of columns
        var children = menu.getChildren('ul');

        menu.setStyle('width', (children.getWidth()[0] * children.length) + 'px');

        // Get sizes after menu positioning
        var windowScroll = window.getScrollSize(),
            windowSize = window.getCoordinates(),
            parentSize = parent.getCoordinates(),
            childSize = menu.getCoordinates();

        // Display menu horizontally on opposite side if it spills out of viewport
        var hWidth = parentSize.right + childSize.width;

        if (hWidth >= windowSize.width) {
            menu.addClass('push-left');
        } else {
            menu.removeClass('push-left');
        }

        // Reverse menu vertically if below half way fold
        if (parentSize.top > (windowScroll.y / 2)) {
            menu.setStyle('top', '-' + (childSize.height - parentSize.height) + 'px');
        } else {
            menu.setStyle('top', 0);
        }

        parent.addClass('is-open');

        this.fireEvent('showChild', parent);
    }

});

/**
 * Defines a component that can be instantiated through flyout().
 */
Toolkit.create('flyout', function(url, options) {
    return new Toolkit.Flyout(this, url, options);
}, true);