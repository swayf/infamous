import 'document-register-element'
//import 'webcomponents.js-v1/src/CustomElements/v1/native-shim'
//import 'webcomponents.js-v1/src/CustomElements/v1/CustomElements'

import styles from './node-style'
import Node from '../motor/Node'
import makeWebComponentBaseClass from './web-component'
import { makeLowercaseSetterAliases, proxyMethods } from '../motor/Utility'

const WebComponent = makeWebComponentBaseClass(window.HTMLElement)
//export default
class MotorHTMLNode extends WebComponent {
    constructor() { super() }

    createdCallback() {
        super.createdCallback()

        // true if motor-node is mounted improperly (not mounted in motor-node or motor-scene)
        this._attachError = false

        this.node = null // to hold the imperative API Node instance.

        // XXX: "this.mountPromise" vs "this.ready":
        // "ready" seems to be more intuitive on the HTML side because
        // if the user has a reference to a motor-node or a motor-scene
        // and it exists in DOM, then it is already "mounted" from the
        // HTML API perspective. Maybe we can use "mountPromise" for
        // the imperative API, and "ready" for the HTML API. For example:
        //
        // await $('motor-scene')[0].ready // When using the HTML API
        // await node.mountPromise // When using the imperative API
        //
        // Or, maybe we can just use ".ready" in both APIs?...
        this._resolveReadyPromise = null
        this.ready = new Promise(r => this._resolveReadyPromise = r)
    }

    attachedCallback() {

        // Check that motor-nodes are mounted to motor-scenes or motor-nodes.
        // Scene can be mounted to any element. In the future we could inspect
        // the scene mount point, and advise about posisble styling issues
        // (f.e. making the scene container have a height).
        //
        // TODO: different check needed when using is="" attributes. For now,
        // we'll discourage use of the awkward is="" attribute.
        if (this.nodeName == 'MOTOR-NODE') {
            if (
                !( this.parentNode.nodeName == 'MOTOR-NODE'
                    || this.parentNode.nodeName == 'MOTOR-SCENE')
                || this.parentNode._attachError
            ) {

                this._attachError = true
                throw new Error('<motor-node> elements must be appended only to <motor-scene> or other <motor-node> elements.')
            }
        }

        super.attachedCallback()
    }

    getStyles() {
        return styles
    }

    init() {
        this._associateImperativeNode()

        // Attach this motor-node's Node to the parent motor-node's
        // Node (doesn't apply to motor-scene, which doesn't have a
        // parent to attach to).
        //
        // TODO: prevent this call if attachedCallback happened to call to
        // addChild on the imperative side.
        if (this.nodeName != 'MOTOR-SCENE')
            this.parentNode.node.addChild(this.node)
    }

    /**
     * This method creates the association between this MotorHTMLNode instance
     * and the imperative Node instance.
     *
     * This method may get called by this.init, but can also be called by
     * the Node class if Node is used imperatively. See Node#constructor.
     *
     * @private
     *
     * @param {Node} imperativeMotorNode The Node to associate with this
     * MotorHTMLNode. This parameter is only used in Node#constructor, and this
     * happens when using the imperative form infamous instead of the HTML
     * interface of infamous. When the HTML interface is used, this gets called
     * first without an imperativeMotorNode argument and the call to this in
     * Node#constructor will then be a noop. Basically, either this gets called
     * first by MotorHTMLNode, or first by Node, depending on which API is used
     * first.
     */
    _associateImperativeNode(imperativeMotorNode) {
        if (!this.node) {
            if (imperativeMotorNode && imperativeMotorNode instanceof Node)
                this.node = imperativeMotorNode
            else
                this.node = this._makeImperativeNode()

            this._signalWhenReady()
        }
    }

    // this is called in attachedCallback, at which point this element hasa
    // parentNode.
    _makeImperativeNode() {
        return new Node({}, this)
    }

    async _signalWhenReady() {
        await this.node.mountPromise
        this._resolveReadyPromise()
    }

    // TODO XXX: remove corresponding imperative Node from it's parent.
    detachedCallback() {
        if (this.nodeName == 'MOTOR-NODE' && this._attachError) {
            this._attachError = false
            return
        }

        super.detachedCallback()
    }

    deinit() {
    }

    attributeChangedCallback(attribute, oldValue, newValue) {
        this._updateNodeProperty(attribute, oldValue, newValue)
    }

    async _updateNodeProperty(attribute, oldValue, newValue) {
        // TODO: Handle actual values (not just string property values as
        // follows) for performance; especially when DOMMatrix is supported
        // by browsers.

        // if not initialized yet, wait.
        if (!this.node) await this.ready

        // attributes on our HTML elements are the same name as those on
        // the Node class (the setters).
        // TODO: make a list of the properties (or get them dynamically) then
        // assign them dynamically.
        if (newValue !== oldValue) {
            if (attribute.match(/opacity/i))
                this.node[attribute] = window.parseFloat(newValue)
            else if (attribute.match(/sizeMode/i))
                this.node[attribute] = parseStringArray(newValue)
            else if (
                attribute.match(/rotation/i)
                || attribute.match(/scale/i) // scale is TODO on imperative side.
                || attribute.match(/position/i)
                || attribute.match(/absoluteSize/i)
                || attribute.match(/proportionalSize/i)
                || attribute.match(/align/i)
                || attribute.match(/mountPoint/i)
                || attribute.match(/origin/i) // origin is TODO on imperative side.
                || attribute.match(/skew/i) // skew is TODO on imperative side.
            ) {
                this.node[attribute] = parseNumberArray(newValue)
            }
            else {
                /* nothing, ignore other attributes */
            }
        }
    }
}

proxyMethods(Node, MotorHTMLNode)

//customElements.define('motor-node', MotorHTMLNode)
export default
document.registerElement('motor-node', MotorHTMLNode)

// for use by MotorHTML, convenient since HTMLElement attributes are all
// converted to lowercase by default, so if we don't do this then we won't be
// able to map attributes to Node setters.
makeLowercaseSetterAliases(Node.prototype)

function parseNumberArray(str) {
    checkIsNumberArrayString(str)
    let numbers = str.split(',')
    return {
        x: window.parseFloat(numbers[0]),
        y: window.parseFloat(numbers[1]),
        z: window.parseFloat(numbers[2]),
    }
}

function parseStringArray(str) {
    checkIsSizeArrayString(str)
    let strings = str.split(',')
    return {
        x: strings[0].trim(),
        y: strings[1].trim(),
        z: strings[2].trim(),
    }
}

function checkIsNumberArrayString(str) {
    if (!str.match(/^\s*(-?((\d+\.\d+)|(\d+))(\s*,\s*)?){3}\s*$/g))
        throw new Error(`Invalid array. Must be an array of numbers of length 3, for example "1, 2.5,3" without brackets. Yours was ${str}.`)
}

function checkIsSizeArrayString(str) {
    // TODO: throw error if str is not a valid array of size mode strings.
    return
}
