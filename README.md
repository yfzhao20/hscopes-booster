# hscopes-booster README

本插件用于提供文本标记 (token) 和作用域 (scope)。

由 `draivin.hscopes` (HyperScopes) 插件重构而来，重写了作用域刷新和识别的逻辑、切去了多余的功能。此插件会在文本改变时刷新文本标记和作用域，而不是直接调用vscode内部的文本解析器（似乎并没有暴露相应的API，因此不得不手写一个）。

本应该给原扩展作者提交PR的，后来发现实在不能完全看懂他的代码，最后只能重写了一个...写的比较乱，性能似乎不如 `draivin.hscopes` ，但是应该更稳定些。

A meta-extension for vscode that provides TextMate scope information. Its intended usage is as a library for other extensions to query scope information. REBUILD from `draivin.hscopes`. 

## Usage

Get `TextMate Scopes` from provided API:

```js
const vscode = require('vscode')

/**
 * @param {vscode.TextDocument} document 
 * @param {vscode.Position} position
 */
function example(document, position){
    const hscopes = vscode.extensions.getExtension('yfzhao.hscopes-booster')
    const token = hscopes.exports.getScopeAt(document, position)
    /* blabla... */
}
```

The return type of `getScopeAt()` is the `object`:
```js
/**
 * @property {vscode.Range} range
 * @property {string[]} scopes
 * @property {string} text
 */ 
```
