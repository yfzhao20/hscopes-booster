"use strict";
const vscode = require('vscode')
const vsctm = require('vscode-textmate')
class DocumentController {
    /**
     * Constructor
     * @param {vscode.TextDocument} doc
     * @param {vsctm.IGrammar} textMateGrammar
     */
    constructor(doc, textMateGrammar) {
        this.document = doc;
        this.subscriptions = [];
        // Stores the state for each line
        this.grammarState = [];
        this.grammar = textMateGrammar;
        // Parse whole document
        this.reparseRange(new vscode.Range(0, 0, this.document.lineCount, 0));
        // Stores text-change range
        this.contentChangesArray = [];
        // onChangeDocument
        this.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document == this.document){
                const changes = [...e.contentChanges].sort((change1, change2) => change1.range.start.isAfter(change2.range.start) ? -1 : 1);
                this.contentChangesArray = changes;
                this.applyChanges(changes)
            }
        }));
    }
    dispose() {
        this.subscriptions.forEach((s) => s.dispose());
    }
    /** parser range */
    /**
     * 
     * @param {vscode.TextLine} line 
     */
    reparseLine(line){
        if(!this.grammar) return;
        const prevState =  this.grammarState[line.lineNumber - 1]?.ruleStack ?? null ;
        const lineTokens = this.grammar.tokenizeLine(line.text, prevState);
        this.grammarState[line.lineNumber] = lineTokens;
    }
    /**
     * @param {vscode.Range} range 
     */
    reparseRange(range){
        range = this.document.validateRange(range)
        for (let lineIndex = range.start.line; lineIndex <= range.end.line; lineIndex ++){
            const line = this.document.lineAt(lineIndex);
            this.reparseLine(line)
        }
    }
    /**
     * @param {vscode.TextDocumentContentChangeEvent[]} changes 
     */
    applyChanges(changes){
        for(let change of changes){
            const initState = this.grammarState[change.range.end.line].ruleStack
            this.reparseRange(this.document.validateRange(change.range))
            const lastState = this.grammarState[change.range.end.line].ruleStack
            // if (插入和原来的行数相等 && 未改变 ruleStack) continue
            // else {parse 整个文档; return} 
            
            if( (change.range.end.line - change.range.start.line) !== (change.text.match(/\r\n|\n|\r/g)?.length ?? 0) || initState !== lastState  ){
                const moreRange = new vscode.Range(change.range.end.line+1, 0 , this.document.lineCount, 0)
                this.reparseRange(this.document.validateRange(moreRange))
                return;
            }
        }
    }
    /** 
     * getScopeAt 
     * @param {vscode.Position} position 
     */
    getScopeAt(position){
        if (!this.grammar)
            return null;
        position = this.document.validatePosition(position);
        // TODO: if (contentChangesRange.length === 0) {get token of line} else {tokenize range}
        // const state = this.grammarState[position.line - 1] ? this.grammarState[position.line - 1].ruleStack: null;
        // const tokens = this.grammar.tokenizeLine(line.text, state);
        // for(let lineIndex = position.line ; this.contentChangesRange.length  &&  lineIndex < this.contentChangesRange[0].start.line ; lineIndex ++ ){
        // }

        if(this.contentChangesArray.length && position.line < this.contentChangesArray[0].range.start.line){
            const change = [{
                range : new vscode.Range(position, this.contentChangesArray[0].range.end),
                text : this.contentChangesArray[0].text,
                rangeOffset : this.contentChangesArray[0].range.start.compareTo(new vscode.Position(0,0)),
                rangeLength: this.contentChangesArray[0].range.end.compareTo(this.contentChangesArray[0].range.start)
            }]
            this.applyChanges(change);
        }
        this.contentChangesArray.length = 0;

        const line = this.document.lineAt(position.line);
        const token = this.grammarState[position.line]

        for (let index = token.tokens.length; index--;) {
            const thisToken = token.tokens[index]
            if (thisToken.startIndex <= position.character ){
                return {
                    range: new vscode.Range(position.line, thisToken.startIndex, position.line, thisToken.endIndex),
                    text: line.text.substring(thisToken.startIndex, thisToken.endIndex),
                    scopes: thisToken.scopes,
                };
            }
        }
        return {
            range: new vscode.Range(position,position),
            text:"",
            scopes: []
        }
    }
    
}

module.exports = {
    DocumentController
}