/*
* @Author: szy
* @Date:   2017-06-30 19:22:00
* @Last Modified by:   szy
* @Last Modified time: 2017-06-30 21:57:57
*/

'use strict';
require.config({
    baseUrl: '',
    paths: {
        jquery: 'vendor/jquery/jquery-3.1.1',
        avalon: 'vendor/avalon/avalon.1.x',//必须修改源码，禁用自带加载器，或直接删提AMD加载器模块
        text: 'vendor/require/text',
        domReady: 'vendor/require/domReady',
        css: 'vendor/require/css.js'
    },
    priority: ['text', 'css'],
    shim: {
        jquery: {
            exports: 'jQuery'
        },
        avalon: {
            exports: 'avalon'
        }
    }
});

require(["avalon", "domReady!"], function () {
    avalon.log('加载avalon完毕，开始构建vm与加载其他模块');
    avalon.templateCache.empty = "&nbsp;";
    avalon.define({
        $id: 'root',
        header: '这是跟模块，用于放置其他模块都共用的东子，比如<b>用户名</b>什么的',
        footer: '页脚消息',
        page: 'empty'
    });
    avalon.scan(document.body);
    require(['./modules/aaa/aaa'], function () {
        avalon.log()
    })
})