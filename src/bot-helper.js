var $ = require('jquery');
var Ector = require('ector');
var merge = require('deepmerge');

module.exports = function() {

    var previousResponseNodes = null;

    var commands = {
        __settings: {
            username: "Stranger",
            botname: "Crystal"
        },
        __brain:{},
        ector:  new Ector(),
        loadSettings: function(){
            this.__settings = merge(this.__settings, JSON.parse(localStorage.__settings || "{}"));
            this.__brain = Object.merge(this.__brain, JSON.parse(localStorage.__brain || "{}"));
            this.changeUsername(this.get('username'));
            this.changeBotName(this.get('botname'));
            this.loadBrain();
        },
        set: function(key, val){
            this.__settings[key] = val;
        },
        get: function(key){
            return this.__settings[key];
        },
        loadBrain: function(){
            var self = this;
            $.ajax({
                method:"GET",
                url:"brain.json",
                dataType:"json",
                success:function(brain){
                    var cn = window.cn = Object.merge(brain, this.__brain);
                    self.ector.cns = {};
                    var newCN = Object.create(require('concept-network').ConceptNetwork.prototype);
                    Object.merge(newCN, cn);
                    self.ector.cn = newCN;
                    self.ector.setUser(self.get("username"));
                    self.ector.setName(self.get("botname"));
                    return false;
                },
                fail: function(){
                    alert("something broke :'(");
                    console.log(arguents)
                }
            });

        },
        save:function(){
            localStorage.setItem("__brain", JSON.stringify(Object.merge(this.__brain, this.ector.cn)));
            localStorage.setItem('__settings', JSON.stringify(this.__settings));
        },
        replyTo: function(convo){
            this.ector.addEntry(convo);
            this.ector.linkNodesToLastSentence(previousResponseNodes);
            var response = this.ector.generateResponse();
            previousResponseNodes = response.nodes;

            // allow crystal to take actions with her own words
            this.selfAwareness(response.sentence);

            return response.sentence;
        },
        changeUsername: function(username) {
            this.ector.setUser(username);
            this.set('username', this.ector.username);

            this.save();
        },
        changeBotName: function(botname){
            this.ector.setName(botname);
            this.set('botname', this.ector.name);

            this.save();
        },
        selfAwareness: function(response){

            var name = response.match(/my name is (\w+)/i);
            if (name && name[1]) {
                this.changeBotName(name);
                return ;
            }

            var remember = response.match(/I\'ll keep that in mind/i) || response.match(/I\'ll remember that/i);

            if(remember && remember[0]) {
                this.save();
            }




        }

    };

    commands.loadSettings();

    return commands;


};



