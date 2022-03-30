# hscopes-booster README

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