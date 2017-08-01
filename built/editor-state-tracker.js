"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("underscore");
const FuzzySet = require("fuzzyset.js");
const events_1 = require("events");
;
/*
 * Tracks a set of remote cursors.
 */
class RemoteCursorMarker extends events_1.EventEmitter {
    constructor(editorState) {
        super();
        this.editorState = editorState;
        this.cursors = {};
    }
    updateCursor(id, user, pos) {
        if (!this.cursors[id]) {
            this.cursors[id] = { id: id, user: user };
            this.editorState.getEditorWrapper().addRemoteCursor(this.cursors[id], this);
        }
        let oldPos = this.cursors[id].pos;
        this.cursors[id].pos = pos;
        if (oldPos) {
            this.editorState.getEditorWrapper().updateRemoteCursorPosition(this.cursors[id], this);
        }
        else {
            this.editorState.getEditorWrapper().addRemoteCursorPosition(this.cursors[id], this);
        }
    }
    ;
    updateSelection(id, user, range) {
        if (!this.cursors[id]) {
            this.cursors[id] = { id: id, user: user };
            this.editorState.getEditorWrapper().addRemoteCursor(this.cursors[id], this);
        }
        let oldRange = this.cursors[id].range;
        this.cursors[id].range = range;
        if (oldRange) {
            this.editorState.getEditorWrapper().updateRemoteCursorSelection(this.cursors[id], this);
        }
        else {
            this.editorState.getEditorWrapper().addRemoteCursorSelection(this.cursors[id], this);
        }
    }
    ;
    removeCursor(id, user) {
        if (this.cursors[id]) {
            this.editorState.getEditorWrapper().removeRemoteCursor(this.cursors[id], this);
            delete this.cursors[id];
        }
    }
    getCursors() {
        return this.cursors;
    }
    serialize() {
        return {
            cursors: this.cursors
        };
    }
    removeUserCursors(user) {
        _.each(this.cursors, (cursor, id) => {
            if (cursor.user.id === user.id) {
                this.removeCursor(id, user);
            }
        });
    }
}
exports.RemoteCursorMarker = RemoteCursorMarker;
class TitleDelta {
    /**
     * Represents a change where the title of the editor window has changed
     */
    constructor(serializedState) {
        this.serializedState = serializedState;
        this.oldTitle = serializedState.oldTitle;
        this.newTitle = serializedState.newTitle;
        this.timestamp = serializedState.timestamp;
    }
    getTimestamp() { return this.timestamp; }
    ;
    doAction(editorState) {
        editorState.setTitle(this.newTitle);
    }
    undoAction(editorState) {
        editorState.setTitle(this.oldTitle);
    }
    serialize() {
        return this.serializedState;
    }
}
class GrammarDelta {
    /**
     * Represents a change where the grammar (think of syntax highlighting rules) has changed
     */
    constructor(serializedState) {
        this.serializedState = serializedState;
        this.oldGrammarName = serializedState.oldGrammarName;
        this.newGrammarName = serializedState.newGrammarName;
        this.timestamp = serializedState.timestamp;
    }
    getTimestamp() { return this.timestamp; }
    ;
    doAction(editorState) {
        const editorWrapper = editorState.getEditorWrapper();
        editorWrapper.setGrammar(this.newGrammarName);
    }
    undoAction(editorState) {
        const editorWrapper = editorState.getEditorWrapper();
        editorWrapper.setGrammar(this.oldGrammarName);
    }
    serialize() { return this.serializedState; }
}
class EditChange {
    /**
     * Represents a change where text has been edited
     */
    constructor(serializedState) {
        this.serializedState = serializedState;
        this.oldRange = serializedState.oldRange;
        this.newRange = serializedState.newRange;
        this.oldText = serializedState.oldText;
        this.newText = serializedState.newText;
    }
    getTimestamp() { return this.timestamp; }
    ;
    doAction(editorState) {
        const editorWrapper = editorState.getEditorWrapper();
        this.updateRanges(editorState);
        editorWrapper.replaceText(this.oldRange, this.newText);
    }
    undoAction(editorState) {
        const editorWrapper = editorState.getEditorWrapper();
        editorWrapper.replaceText(this.newRange, this.oldText);
    }
    addAnchor(editorState) {
        const editorWrapper = editorState.getEditorWrapper();
        this.oldRangeAnchor = editorWrapper.getAnchor(this.oldRange);
        this.newRangeAnchor = editorWrapper.getAnchor(this.newRange);
    }
    updateRanges(editorState) {
        const editorWrapper = editorState.getEditorWrapper();
        this.oldRange = editorWrapper.getCurrentAnchorPosition(this.oldRangeAnchor);
        this.newRange = editorWrapper.getCurrentAnchorPosition(this.newRangeAnchor);
    }
    serialize() { return this.serializedState; }
}
class EditDelta {
    /**
     * Represents a change made to the text of a document. Contains a series of EditChange
     * objects representing the individual changes
     */
    constructor(serializedState) {
        this.serializedState = serializedState;
        this.timestamp = serializedState.timestamp;
        this.changes = serializedState.changes.map((ss) => {
            return new EditChange(ss);
        });
    }
    getTimestamp() { return this.timestamp; }
    ;
    doAction(editorState) {
        this.changes.forEach((c) => {
            c.doAction(editorState);
        });
    }
    undoAction(editorState) {
        this.changes.forEach((c) => {
            c.undoAction(editorState);
        });
    }
    addAnchors(editorState) {
        this.changes.forEach((c) => {
            c.addAnchor(editorState);
        });
    }
    serialize() { return this.serializedState; }
}
class OpenDelta {
    /**
     * Represents a new text editor being opened
     */
    constructor(serializedState) {
        this.serializedState = serializedState;
        this.grammarName = serializedState.grammarName;
        this.title = serializedState.title;
        this.timestamp = serializedState.timestamp;
        this.contents = serializedState.contents;
    }
    getTimestamp() { return this.timestamp; }
    ;
    doAction(editorState) {
        const editorWrapper = editorState.getEditorWrapper();
        editorState.title = this.title;
        editorState.isOpen = true;
        editorWrapper.setGrammar(this.grammarName);
        editorWrapper.setText(this.contents);
    }
    undoAction(editorState) {
        const editorWrapper = editorState.getEditorWrapper();
        editorState.title = '';
        editorState.isOpen = false;
        editorWrapper.setText('');
    }
    serialize() { return this.serializedState; }
}
class DestroyDelta {
    /**
     * Represents a text editor being closed.
     */
    constructor(serializedState) {
        this.serializedState = serializedState;
        this.timestamp = serializedState.timestamp;
    }
    getTimestamp() { return this.timestamp; }
    ;
    doAction(editorState) {
        editorState.isOpen = false;
    }
    undoAction(editorState) {
        editorState.isOpen = true;
    }
    serialize() { return this.serializedState; }
}
class ModifiedDelta {
    /**
     * Represents a change to the *modified* flag (which marks if a file has been changed
     * without having been saved)
     */
    constructor(serializedState) {
        this.serializedState = serializedState;
        this.timestamp = serializedState.timestamp;
        this.modified = serializedState.modified;
        this.oldModified = serializedState.oldModified;
    }
    getTimestamp() { return this.timestamp; }
    ;
    doAction(editorState) {
        editorState.modified = this.modified;
    }
    undoAction(editorState) {
        editorState.modified = this.oldModified;
    }
    serialize() { return this.serializedState; }
}
class EditorState {
    constructor(suppliedState, editorWrapper, mustPerformChange) {
        this.editorWrapper = editorWrapper;
        this.deltas = [];
        this.selections = {};
        this.remoteCursors = new RemoteCursorMarker(this);
        let state = _.extend({
            isOpen: true,
            deltas: [],
            cursors: []
        }, suppliedState);
        this.editorWrapper.setEditorState(this);
        this.editorID = state.id;
        if (mustPerformChange) {
            state.deltas.forEach((d) => {
                this.addDelta(d, true);
            });
        }
        state.cursors.forEach((c) => {
        });
    }
    serialize() {
        return {
            deltas: _.map(this.deltas, d => d.serialize()),
            isOpen: this.isOpen,
            id: this.editorID,
            title: this.title,
            modified: this.modified,
            remoteCursors: this.remoteCursors.serialize()
        };
    }
    ;
    setTitle(newTitle) { this.title = newTitle; }
    ;
    setIsOpen(val) { this.isOpen = val; }
    ;
    getEditorWrapper() { return this.editorWrapper; }
    ;
    getTitle() { return this.title; }
    ;
    getIsOpen() { return this.isOpen; }
    ;
    getRemoteCursors() { return this.remoteCursors; }
    ;
    getEditorID() { return this.editorID; }
    ;
    getIsModified() { return this.modified; }
    ;
    addHighlight(range) {
        return this.getEditorWrapper().addHighlight(range);
    }
    removeHighlight(highlightID) {
        return this.getEditorWrapper().removeHighlight(highlightID);
    }
    focus(range) {
        return this.getEditorWrapper().focus(range);
    }
    addDelta(serializedDelta, mustPerformChange) {
        const { type } = serializedDelta;
        let delta;
        if (type === 'open') {
            delta = new OpenDelta(serializedDelta);
        }
        else if (type === 'edit') {
            delta = new EditDelta(serializedDelta);
        }
        else if (type === 'modified') {
            delta = new ModifiedDelta(serializedDelta);
        }
        else if (type === 'grammar') {
            delta = new GrammarDelta(serializedDelta);
        }
        else if (type === 'title') {
            delta = new TitleDelta(serializedDelta);
        }
        else if (type === 'destroy') {
            delta = new DestroyDelta(serializedDelta);
        }
        else {
            delta = null;
            console.log(serializedDelta);
        }
        if (delta) {
            this.handleDelta(delta, mustPerformChange);
        }
        return delta;
    }
    handleDelta(delta, mustPerformChange) {
        //A simplified operational transformation insertion
        if (delta instanceof EditDelta) {
            delta.addAnchors(this);
        }
        //Go back and undo any deltas that should have been done after this delta
        let i = this.deltas.length - 1;
        let d;
        for (; i >= 0; i--) {
            d = this.deltas[i];
            if (d.getTimestamp() > delta.getTimestamp()) {
                d.undoAction(this);
            }
            else {
                break;
            }
        }
        // Insert this delta where it should be
        const insertAt = i + 1;
        this.deltas.splice(insertAt, 0, delta);
        if (mustPerformChange) {
            i = insertAt; // will include this delta as we move forward
        }
        else {
            i = insertAt + 1;
        }
        // Go forward and do allof the deltas that come before.
        for (; i < this.deltas.length; i++) {
            d = this.deltas[i];
            d.doAction(this);
        }
    }
    removeUserCursors(user) {
        this.remoteCursors.removeUserCursors(user);
    }
}
exports.EditorState = EditorState;
class EditorStateTracker {
    constructor(EditorWrapperClass, channelCommunicationService) {
        this.EditorWrapperClass = EditorWrapperClass;
        this.channelCommunicationService = channelCommunicationService;
        this.editorStates = {};
    }
    getAllEditors() {
        return _.values(this.editorStates);
    }
    handleEvent(event, mustPerformChange) {
        const editorState = this.getEditorState(event.id);
        if (editorState) {
            editorState.addDelta(event, mustPerformChange);
        }
    }
    ;
    getEditorState(editorID) {
        if (this.editorStates[editorID]) {
            return this.editorStates[editorID];
        }
        else {
            return null;
        }
    }
    getActiveEditors() {
        const rv = _.filter(this.getAllEditors(), s => s.getIsOpen());
        return rv;
    }
    onEditorOpened(state, mustPerformChange) {
        let editorState = this.getEditorState(state.id);
        if (!editorState) {
            editorState = new EditorState(state, new this.EditorWrapperClass(state, this.channelCommunicationService), mustPerformChange);
            this.editorStates[state.id] = editorState;
        }
        return editorState;
    }
    serializeEditorStates() {
        return _.mapObject(this.editorStates, editorState => editorState.serialize());
    }
    ;
    removeUserCursors(user) {
        _.each(this.editorStates, (es) => {
            es.removeUserCursors(user);
        });
    }
    addHighlight(editorID, range) {
        editorID = this.getAllEditors()[0].getEditorID();
        const editorState = this.getEditorState(editorID);
        if (editorState) {
            return editorState.addHighlight(range);
        }
        else {
            return -1;
        }
    }
    removeHighlight(editorID, hightlightID) {
        editorID = this.getAllEditors()[0].getEditorID();
        const editorState = this.getEditorState(editorID);
        if (editorState) {
            return editorState.removeHighlight(hightlightID);
        }
        else {
            return false;
        }
    }
    focus(editorID, range) {
        editorID = this.getAllEditors()[0].getEditorID();
        const editorState = this.getEditorState(editorID);
        if (editorState) {
            return editorState.focus(range);
        }
        else {
            return false;
        }
    }
    fuzzyMatch(query) {
        const editors = this.getAllEditors();
        const editorTitleSet = new FuzzySet(_.map(editors, (e) => e.getTitle()));
        const matches = editorTitleSet.get(query);
        if (matches) {
            const bestTitleMatch = matches[0][1];
            const matchingTitles = _.filter(this.getAllEditors(), (es) => es.getTitle() === bestTitleMatch);
            if (matchingTitles.length > 0) {
                return matchingTitles[0];
            }
        }
        return null;
    }
}
exports.EditorStateTracker = EditorStateTracker;
//# sourceMappingURL=editor-state-tracker.js.map