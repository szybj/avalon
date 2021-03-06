//双工绑定
var rduplexType = /^(?:checkbox|radio)$/
var rduplexParam = /^(?:radio|checked)$/
var rnoduplexInput = /^(file|button|reset|submit|checkbox|radio|range)$/
var duplexBinding = avalon.directive("duplex", {
    priority: 2000,
    init: function (binding, hasCast) {
        var elem = binding.element
        var vmodels = binding.vmodels
        binding.changed = getBindingCallback(elem, "data-duplex-changed", vmodels) || noop
        var params = []
        var casting = oneObject("string,number,boolean,checked")
        if (elem.type === "radio" && binding.param === "") {
            binding.param = "checked"
        }


        binding.param.replace(rw20g, function (name) {
            if (rduplexType.test(elem.type) && rduplexParam.test(name)) {
                if (name === "radio")
                    log("ms-duplex-radio已经更名为ms-duplex-checked")
                name = "checked"
                binding.isChecked = true
                binding.xtype = "radio"
            }
            if (name === "bool") {
                name = "boolean"
                log("ms-duplex-bool已经更名为ms-duplex-boolean")
            } else if (name === "text") {
                name = "string"
                log("ms-duplex-text已经更名为ms-duplex-string")
            }
            if (casting[name]) {
                hasCast = true
            }
            avalon.Array.ensure(params, name)
        })
        if (!hasCast) {
            params.push("string")
        }
        binding.param = params.join("-")
        if (!binding.xtype) {
            binding.xtype = elem.tagName === "SELECT" ? "select" :
                    elem.type === "checkbox" ? "checkbox" :
                    elem.type === "radio" ? "radio" :
                    /^change/.test(elem.getAttribute("data-duplex-event")) ? "change" :
                    "input"
        }
        //===================绑定事件======================
        var bound = binding.bound = function (type, callback) {
            if (elem.addEventListener) {
                elem.addEventListener(type, callback, false)
            } else {
                elem.attachEvent("on" + type, callback)
            }
            var old = binding.rollback
            binding.rollback = function () {
                elem.avalonSetter = null
                avalon.unbind(elem, type, callback)
                old && old()
            }
        }
        function callback(value) {
            binding.changed.call(this, value, binding)
        }
        var composing = false
        function compositionStart() {
            composing = true
        }
        function compositionEnd() {
            composing = false
            setTimeout(updateVModel)
        }

        var updateVModel = function (e) {
            var val = elem.value //防止递归调用形成死循环
            if (composing || val === binding.oldValue || binding.pipe === null) //处理中文输入法在minlengh下引发的BUG
                return
            var lastValue = binding.pipe(val, binding, "get")
            try {
                binding.oldValue = val
                binding.setter(lastValue)
                callback.call(elem, lastValue)
            } catch (ex) {
                log(ex)
            }
        }
        switch (binding.xtype) {
            case "radio":
                binding.bound("click", function () {
                    var lastValue = binding.pipe(elem.value, binding, "get")
                    try {
                        binding.setter(lastValue)
                        callback.call(elem, lastValue)
                    } catch (ex) {
                        log(ex)
                    }
                })
                break
            case "checkbox":
                bound(W3C ? "change" : "click", function () {
                    var method = elem.checked ? "ensure" : "remove"
                    var array = binding.getter.apply(0, binding.vmodels)
                    if (!Array.isArray(array)) {
                        log("ms-duplex应用于checkbox上要对应一个数组")
                        array = [array]
                    }
                    var val = binding.pipe(elem.value, binding, "get")
                    avalon.Array[method](array, val)
                    callback.call(elem, array)
                })
                break
            case "change":
                bound("change", updateVModel)
                break
            case "input":
                if (!IEVersion) { // W3C
                    bound("input", updateVModel)
                    //非IE浏览器才用这个
                    bound("compositionstart", compositionStart)
                    bound("compositionend", compositionEnd)
                    bound("DOMAutoComplete", updateVModel)
                } else {
                    // IE下通过selectionchange事件监听IE9+点击input右边的X的清空行为，及粘贴，剪切，删除行为
                    if (IEVersion > 8) {
                        if (IEVersion === 9) {
                            //IE9删除字符后再失去焦点不会同步 #1167
                            bound("keyup", updateVModel)
                        }
                        bound("input", updateVModel) //IE9使用propertychange无法监听中文输入改动
                    } else {
                        //onpropertychange事件无法区分是程序触发还是用户触发
                        //IE6-8下第一次修改时不会触发,需要使用keydown或selectionchange修正
                        bound("propertychange", function (e) {
                            if (e.propertyName === "value") {
                                updateVModel()
                            }
                        })
                    }
                    bound("dragend", function () {
                        setTimeout(function () {
                            updateVModel()
                        }, 17)
                    })
                    //http://www.cnblogs.com/rubylouvre/archive/2013/02/17/2914604.html
                    //http://www.matts411.com/post/internet-explorer-9-oninput/
                }
                break
            case "select":
                bound("change", function () {
                    var val = avalon(elem).val() //字符串或字符串数组
                    if (Array.isArray(val)) {
                        val = val.map(function (v) {
                            return binding.pipe(v, binding, "get")
                        })
                    } else {
                        val = binding.pipe(val, binding, "get")
                    }
                    if (val + "" !== binding.oldValue) {
                        try {
                            binding.setter(val)
                        } catch (ex) {
                            log(ex)
                        }
                    }
                })
                bound("datasetchanged", function (e) {
                    if (e.bubble === "selectDuplex") {
                        var value = binding._value
                        var curValue = Array.isArray(value) ? value.map(String) : value + ""
                        avalon(elem).val(curValue)
                        elem.oldValue = curValue + ""
                        callback.call(elem, curValue)
                    }
                })
                break
        }
        if (binding.xtype === "input" && !rnoduplexInput.test(elem.type)) {
            if (elem.type !== "hidden") {
                bound("focus", function () {
                    elem.msFocus = true
                })
                bound("blur", function () {
                    elem.msFocus = false
                })
            }
            elem.avalonSetter = updateVModel //#765
            watchValueInTimer(function () {
                if (avalon.contains(root, elem)) {
                    if (!this.msFocus) {
                        updateVModel()
                    }
                } else if (!elem.msRetain) {
                    return false
                }
            })
        }

    },
    update: function (value) {
        var elem = this.element, binding = this, curValue
        if (!this.init) {
            for (var i in avalon.vmodels) {
                var v = avalon.vmodels[i]
                v.$fire("avalon-ms-duplex-init", binding)
            }
            var cpipe = binding.pipe || (binding.pipe = pipe)
            cpipe(null, binding, "init")
            this.init = 1
        }
        switch (this.xtype) {
            case "input":
            case "change":
                curValue = this.pipe(value, this, "set")  //fix #673
                if (curValue !== this.oldValue) {
                    var fixCaret = false
                    if (elem.msFocus) {
                        try {
                            var pos = getCaret(elem)
                            if (pos.start === pos.end) {
                                pos = pos.start
                                fixCaret = true
                            }
                        } catch (e) {
                        }
                    }
                    elem.value = binding.oldValue = curValue
                    if (fixCaret) {
                        setCaret(elem, pos, pos)
                    }
                }
                break
            case "radio":
                curValue = binding.isChecked ? !!value : value + "" === elem.value
                if (IEVersion === 6) {
                    setTimeout(function () {
                        //IE8 checkbox, radio是使用defaultChecked控制选中状态，
                        //并且要先设置defaultChecked后设置checked
                        //并且必须设置延迟
                        elem.defaultChecked = curValue
                        elem.checked = curValue
                    }, 31)
                } else {
                    elem.checked = curValue
                }
                break
            case "checkbox":
                var array = [].concat(value) //强制转换为数组
                curValue = this.pipe(elem.value, this, "get")
                elem.checked = array.indexOf(curValue) > -1
                break
            case "select":
                //必须变成字符串后才能比较
                binding._value = value
                if (!elem.msHasEvent) {
                    elem.msHasEvent = "selectDuplex"
                    //必须等到其孩子准备好才触发
                } else {
                    avalon.fireDom(elem, "datasetchanged", {
                        bubble: elem.msHasEvent
                    })
                }
                break
        }
    }
})

if (IEVersion) {
    avalon.bind(DOC, "selectionchange", function (e) {
        var el = DOC.activeElement || {}
        if (!el.msFocus && el.avalonSetter) {
            el.avalonSetter()
        }
    })
}

function fixNull(val) {
    return val == null ? "" : val
}
avalon.duplexHooks = {
    checked: {
        get: function (val, binding) {
            return !binding.oldValue
        }
    },
    string: {
        get: function (val) { //同步到VM
            return val
        },
        set: fixNull
    },
    "boolean": {
        get: function (val) {
            return val === "true"
        },
        set: fixNull
    },
    number: {
        get: function (val, binding) {
            var number = parseFloat(val + "")
            if (-val === -number) {
                return number
            }

            var arr = /strong|medium|weak/.exec(binding.element.getAttribute("data-duplex-number")) || ["medium"]
            switch (arr[0]) {
                case "strong":
                    return 0
                case "medium":
                    return val === "" ? "" : 0
                case "weak":
                    return val
            }
        },
        set: fixNull
    }
}

function pipe(val, binding, action) {
    binding.param.replace(rw20g, function (name) {
        var hook = avalon.duplexHooks[name]
        if (hook && typeof hook[action] === "function") {
            val = hook[action](val, binding)
        }
    })
    return val
}

var TimerID, ribbon = []

avalon.tick = function (fn) {
    if (ribbon.push(fn) === 1) {
        TimerID = setInterval(ticker, 60)
    }
}

function ticker() {
    for (var n = ribbon.length - 1; n >= 0; n--) {
        var el = ribbon[n]
        if (el() === false) {
            ribbon.splice(n, 1)
        }
    }
    if (!ribbon.length) {
        clearInterval(TimerID)
    }
}

var watchValueInTimer = noop
new function () { // jshint ignore:line
    try { //#272 IE9-IE11, firefox
        var setters = {}
        var aproto = HTMLInputElement.prototype
        var bproto = HTMLTextAreaElement.prototype
        function newSetter(value) { // jshint ignore:line
            setters[this.tagName].call(this, value)
            if (!this.msFocus && this.avalonSetter) {
                this.avalonSetter()
            }
        }
        var inputProto = HTMLInputElement.prototype
        Object.getOwnPropertyNames(inputProto) //故意引发IE6-8等浏览器报错
        setters["INPUT"] = Object.getOwnPropertyDescriptor(aproto, "value").set

        Object.defineProperty(aproto, "value", {
            set: newSetter
        })
        setters["TEXTAREA"] = Object.getOwnPropertyDescriptor(bproto, "value").set
        Object.defineProperty(bproto, "value", {
            set: newSetter
        })
    } catch (e) {
        //在chrome 43中 ms-duplex终于不需要使用定时器实现双向绑定了
        // http://updates.html5rocks.com/2015/04/DOM-attributes-now-on-the-prototype
        // https://docs.google.com/document/d/1jwA8mtClwxI-QJuHT7872Z0pxpZz8PBkf2bGAbsUtqs/edit?pli=1
        watchValueInTimer = avalon.tick
    }
} // jshint ignore:line
function getCaret(ctrl) {
    var start = NaN, end = NaN
    if (ctrl.setSelectionRange) {
        start = ctrl.selectionStart
        end = ctrl.selectionEnd
    } else if (document.selection && document.selection.createRange) {
        var range = document.selection.createRange()
        start = 0 - range.duplicate().moveStart('character', -100000)
        end = start + range.text.length
    }
    return {
        start: start,
        end: end
    }
}
function setCaret(ctrl, begin, end) {
    if (!ctrl.value || ctrl.readOnly)
        return
    if (ctrl.createTextRange) {//IE6-8
        var range = ctrl.createTextRange()
        range.collapse(true)
        range.moveStart("character", begin)
        range.select()
    } else {
        ctrl.selectionStart = begin
        ctrl.selectionEnd = end
    }
}