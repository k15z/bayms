Vue.directive('sortable', {
    twoWay: true,
    deep: true,
    bind: function () {
        var that = this;

        var options = {
            draggable: Object.keys(this.modifiers)[0]
        };

        this.sortable = Sortable.create(this.el, options);

        this.sortable.option("onUpdate", function (e) {            
            that.value.event.piece.splice(e.newIndex, 0, that.value.event.piece.splice(e.oldIndex, 1)[0]);
        });

        this.onUpdate = function(value) {            
            that.value = value;
        }
    },
    update: function (value) {        
        this.onUpdate(value);
    }
});
