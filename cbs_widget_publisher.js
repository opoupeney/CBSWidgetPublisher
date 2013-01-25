/*
	Widget Publisher
	(c) 2013 - Capital Banking Solutions
*/

function cbsWidgetPublisher( dataWidget ) {
	dataWidget.clearContent();
	
	var dq = new DataQuery( "TestPublisher" );
	dq.execute( null, function(dataSet) {
		var buffer = dataSet.getData();
		if ( buffer !== null && buffer["coResultVal"] !== null ) {
			var items = buffer[0].coResultVal;
			var publisher = new CBSPublisher(items);
			
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
			dataWidget.addContent( publisher.reportName );
		}
	});
	
}

function CBSPublisher(items) {
	this.items = items;
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
