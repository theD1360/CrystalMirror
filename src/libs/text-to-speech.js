// Create a new utterance for the specified text and add it to
// the queue.

function cutString(s, n){
    var cut= s.indexOf(' ', n);
    if(cut== -1) return s;
    return s.substring(0, cut)
}

var synth = function(voiceName) {
    // Create a new instance of SpeechSynthesisUtterance.
    this.msg = new SpeechSynthesisUtterance();
    var self = this;

    this.loadVoices = function() {
        // Fetch the available voices.
        this.voices = speechSynthesis.getVoices();

    };
    window.speechSynthesis.onvoiceschanged = function(e) {
        self.loadVoices();
        self.changeVoice(self.voiceName);
    };

    this.construct = function(voiceName) {


        // Set the text.
        // Set the attributes.
        this.msg.volume = parseFloat(1);
        this.msg.rate = parseFloat(1);
        this.msg.pitch = parseFloat(1);
        this.before = null;
        this.voiceName = voiceName;

        this.changeVoice(voiceName);


    };

    this.loadVoices();

    return this.construct(voiceName);

};

synth.prototype.changeVoice = function(voiceName) {
    if(!this.voices) {
        return;
    }

    if (!voiceName) {
        this.msg.voice = this.voices[0][0];
    }
    this.msg.voice = this.voices.filter(function (voice) {
        return voice.name == voiceName;
    })[0];

};

synth.prototype.onBefore = function(callback) {
    this.before = callback;
};

synth.prototype.onAfter = function(callback) {
    this.msg.onend = callback;
    this.after = callback;
};

synth.prototype.speak = function(message) {
    this.msg.text = cutString(message, 250);

    if (typeof this.before == "function") {
        this.before(message);
    }

    window.speechSynthesis.speak(this.msg);

    if (typeof this.after == "function") {
        this.after(message);
    }

};



module.exports = synth;

