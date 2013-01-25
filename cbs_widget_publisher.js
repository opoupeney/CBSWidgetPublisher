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
	return this;
}

CBSPublisher.prototype.type="CBSPublisher";

CBSPublisher.prototype.parseItem=function( item, index ) {
	var nextIndex = index+1;
	if ( item.dimName == "CR" ) {
		this.setReportName( item.c01 );
	} else if ( item.dimName == "CT" ) {
		// todo
	}
	return nextIndex;
}

CBSPublisher.prototype.setReportName=function( name ) {
	this.reportName = name;
}

CBSPublisher.prototype.renderReport=function() {
	var reportPanel = Ext.create('Ext.panel.Panel', {
		title: this.reportName,
    	width: "99%",
	    height: 400,
    	renderTo: this.wgt_placeolder_id,
	    layout: {
    	    type: "vbox",
        	align: "stretch",
	        padding: 5
    	},
	    items: [
    		{
        		xtype: "grid",
	        	columns: [{header: "Column One"}],
	    	    store: Ext.create("Ext.data.ArrayStore", {}),
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