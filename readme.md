Crystal Mirror
==============

Nodejs magic mirror with voice recognition and speech synthesis.

[Live demo](http://crystal-mirror.herokuapp.com/)


**Installation**

```
cd your/directory/
mv .env.example .env
npm install
npm start
```

Then navigate to the http://localhost:PORT replace PORT 
with the specified in your .env

**Modules**

The only modules available right now are:
* Welcome
* Time
* Calendar 

Hopefully the list will grow as people contribute.

**Voice Commands**

Grid/Layout:

    Say "Show/Hide grid" toggle the grid

    Say "Swap row x and row y" to change row order
    Say "Add row" to add a row
    Say "Remove row x" to remove a row

    Say "Add cell to row x" to add a cell to a row
    Say "Remove cell xx" to remove a cell
    Say "Swap cell xx and cell yy" to swap two cells
    Say "set cell xx to 'module name'" to set the module
    Say "Make cell xx smaller/bigger" to change the cells width


    Say "Save layout" to save your layout changes
    
Conversation:

    Say "Tell me 'something'" to have Crystal do a google search
    Say "Let's chat" to have a conversation with Crystal
    Say "Ok, I'm done" or "Ok, shut up" to end a conversation with Crystal

General:

    Say "Go Back" to navigate back
    Say "Restart" to restart the page


**Contributions**

Contributions are welcome.
