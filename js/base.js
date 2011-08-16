$(document).ready(function(){
	
	// should probably be calling the app init
	var setup = function(){		
		var t = $('#kittenheaven').carrotCell({
			infinite: false, 
			pad: false,
			speed: 1000,
			delay: 3000,
			navi: true,
			key: true // reads the entire doc so can only do 1 carousel
			// auto: true // if auto is true so is infinite
		});
		
		var h = $('#kittenhell').carrotCell({
			sideways: false,
			delay: 3000,
			key: true,
			navi: true,
			step:1
			// auto: true
		});
		
		var apih = $(h).data('carrotCell');
		var api = $(t).data('carrotCell');
		var item = '<li><span>10</span><img src="images/dog01.png" /></li>';
		api.insert(item);

	}
	
	// chrome can not calculate the width correctly because it is foolish
	var is_chrome = navigator.userAgent.toLowerCase().indexOf('chrome') > -1;
	if (is_chrome) {
		$(window).load(function(){ setup(); });
	} else {
		setup();
	}
});


