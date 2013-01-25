/*
	Widget Publisher
	(c) 2013 - Capital Banking Solutions
*/

function cbsWidgetPublisher( dataWidget ) {
	dataWidget.clearContent();
	var wgt_placeolder_id = Math.uuid( 10,10 );
	dataWidget.addContent( "<div id=\"" + wgt_placeolder_id + "\" style=\"width:100%;height:420px;\"></div>" );
	
	var dq = new DataQuery( "TestPublisher" );
	dq.execute( null, function(dataSet) {
		var buffer = dataSet.getData();
		if ( buffer !== null && buffer["coResultVal"] !== null ) {
			var items = buffer[0].coResultVal;
			var publisher = new CBSPublisher(items, dataWidget, wgt_placeolder_id);
			
			var parseContinue = true;
			var parseIndex = 0;
			var loopIndex = 0;
			var loopLimit = 2000;
			
			while (parseContinue) {
				loopIndex++;
				parseIndex = publisher.parseItem( items[parseIndex], parseIndex );
				if ( parseIndex >= items.length || loopIndex > loopLimit ) {
					parseContinue = false;
				}
			}
			publisher.renderReport();
		}
	});
	
}

function CBSPublisher(items, dataWidget, wgt_placeolder_id) {
	this.items = items;
	this.dataWidget = dataWidget;
	this.wgt_placeolder_id = wgt_placeolder_id;
	this.reportName = null;
	this.gridColumns = new Array();
	this.gridFields_level_1 = new Array();
	this.gridData_level_1 = new Array();
	return this;
}

CBSPublisher.prototype.type="CBSPublisher";

CBSPublisher.prototype.parseItem=function( item, index ) {
	var nextIndex = index+1;
	if ( item.dimName == "CR" ) {
		this.setReportName( item.c01 );
	} else if ( item.dimName == "CT" ) {
		var colIndex = this.gridFields_level_1.length;
		this.gridColumns.push( {header: item.c02, dataIndex: "c"+(colIndex+1)} );
		this.gridFields_level_1.push( {name: "c"+(colIndex+1)} );
	} else if ( item.dimName == "1" ) {
		var row = new Object();
		for (var i=1; i<(this.gridFields_level_1.length+1); i++) {
			row["c"+i] = (i<10) ? item["c0"+i] : item["c"+i];
		}
		this.gridData_level_1.push( row );
	}
	
	this.gridColumns.push( {header: "", dataIndex: "caction"} );
	
	return nextIndex;
}

CBSPublisher.prototype.setReportName=function( name ) {
	this.reportName = name;
}

CBSPublisher.prototype.renderReport=function() {
	var reportPanel = Ext.create('Ext.panel.Panel', {
		title: this.reportName,
    	width: 800,
	    height: 500,
    	renderTo: this.wgt_placeolder_id,
	    layout: {
    	    type: "vbox",
        	align: "stretch",
	        padding: 5
    	},
	    items: [
    		{
        		xtype: "grid",
	        	columns: this.gridColumns,
	    	    store: Ext.create("Ext.data.Store", { fields: this.gridFields_level_1, data: this.gridData_level_1 }),
    	    	flex: 1
    		}, {
        		xtype: "splitter"
		    }, {
    	    	title: "Details",
	    	    bodyPadding: 5,
    	    	items: [{
        	    	fieldLabel: "Data item",
	            	xtype: "textfield"
		        }],
    		    flex: 2
    		}
    	]
	});
}