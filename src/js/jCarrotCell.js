/*!
 * jCarrotCell
 * http://jcarrotcell.yujulia.com
 * 
 * Copyright 2011, 2015 
 * Released under the MIT license
 *
 */

(function($){

    // --- global constants

    var KEY_BACK = 37,          // left arrow
        KEY_FORWARD = 39,       // right arrow
        KEY_UP = 38,            // up arrow
        KEY_DOWN = 40,          // down arrow
        KEY_TOGGLE = 80,        // p

        DEBOUNCE_RATE = 200,

        ROOT = 'carrotcell',

        DATA_API = ROOT + '__api',
        DATA_ENUM = ROOT + '__enum',

        // CSS class names used

        CLASS_ON = ROOT + '--on',
        CLASS_VERTICAL = ROOT + '--vertical',
        CLASS_INVIS = ROOT + "--invisible",

        CLASS_CLIP = ROOT + '__clip',
        CLASS_SLIDER = ROOT + '__strip',
        CLASS_ITEM = ROOT + '__item',
        CLASS_CLONE = ROOT + "__clone",
        CLASS_ACCESS_TEXT = ROOT + '__accessText',
        CLASS_NAVI = ROOT + "__navi",
        CLASS_DOT = ROOT + "__dot",

        CLASS_ICON = ROOT + '__icon',
        CLASS_NEXT_ICON = CLASS_ICON + '--next',
        CLASS_PREV_ICON = CLASS_ICON + '--prev',
        CLASS_PAUSE_ICON = CLASS_ICON + '--pause',
        CLASS_PLAY_ICON = CLASS_ICON + '--play',

        CLASS_DOT_ICON = CLASS_ICON + '--dot',

        CLASS_BTN = ROOT + '__btn',
        CLASS_NEXT = CLASS_BTN + '--next',
        CLASS_PREV = CLASS_BTN + '--prev',
        CLASS_PAUSE = CLASS_BTN + '--pause',
        CLASS_PLAY = CLASS_BTN + '--play',
        CLASS_DOT_BTN = CLASS_BTN + '--dot';

    // --- debounce helper 

    var debounce = function(callback, ms){
        var timeout = null;
        return function(){
            var context = this, args = arguments;
            var stalled = function(){
                timeout = null;
                callback.apply(context, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(stalled, ms);
        };
    };

    // --- check if something is an integer

    var isInteger = function(input) {
        if (input === parseInt(input, 10)) {
            return true;
        } else {
            return false;
        }
    };

    // --- check if something is in array

    var inArray = function(someArray, someItem){
        var index = someArray.indexOf(someItem);
        if (index < 0) { return false; } else { return true; }
    };

    /** ---------------------------------------
        carrot methods
    */
    var carrot = function(){

        var scope = null,               // shorthand for settings.scope
            width = 0,                  // container width
            height = 0,                 // container height
            clipPane = null,            // clipping box
            slider = null,              // sliding panel
            clones = null,              // clones for infinite scroll
            items = null,               // all items elements
            total = 0,                  // items count
            one = null,                 // 1 item

            prev = null,
            next = null,
            pause = null,
            play = null,
            controls = $(),             // all the controls

            showing = [],               // what items are visible
            current = 0,                // current item scrolled to
            alreadyMoved = 0,           // how many items already moved past
            scrollBy = 0,

            enoughToScroll = false,     // is there enough items to scroll
            atStart = true,             // no more in prev
            atEnd = false,              // no more in next
            direction = 1,              // direction we scrolling
            firstOfEnd = 0,             // first item in end view
            onCloneStart = false,       // are we on a starting clone (negative number)
            onCloneEnd = false,

            navi = null,                // contains dots
            dots = null,                // all the dot buttons
            sets = 0,                   // how many clicks before we reach the end
            setItems = [],              // what each dot maps to

            useVelocity = false,        // use velocity to animate?
            animating = false,          // animation lock
            axis = "x",
            adjustProperty = "width",   // animate this property

            playing = false,           
            paused = false,
            timer = null,           

            // --- these settings can be over written

            settings = {
                show: 1,                // show 1 frame at a time
                scroll: 1,              // scroll 1 frame at a time
                duration: 500,          // scroll animation duration         
                sideways: true,         // scroll sideways
                easing: "swing",        // slide easing method
   
                infinite : false,       // infinite scroll
                auto : false,           // auto loop if circular
                autoDuration : 2000,    // how long to pause on an item

                stopOnHover : true,     // stop auto advance on hover
                controlOnHover : false, // show controls on hover only
                dotsOnHover: false,     // show dots on hover
  
                useDots : false,
                naviClass : '',
                dotClass : '',

                dotIconClass : CLASS_DOT_ICON,
                dotButtonClass : '',
                dotText : 'item set ',
                onClass : CLASS_ON,

                usePausePlay : true,
                pauseClass: '',
                pauseIconClass : CLASS_PAUSE_ICON,
                pauseText : 'pause auto scroll',
                playClass : '',
                playIconClass : CLASS_PLAY_ICON,
                playText : 'resume auto scroll',

                usePrevNext : true,
                prevClass : '',
                prevIconClass : CLASS_PREV_ICON,
                prevText : 'next item set',
                nextClass : '',
                nextIconClass : CLASS_NEXT_ICON,
                nextText : 'previous item set',

                key : false,
                keyBack : '',
                keyForward : '',
                keyToggle : KEY_TOGGLE
            };

        // --- send error msg to track with this carrotcell name

        var error = function(){
            var args = Array.prototype.slice.call(arguments);
            args.unshift(settings.name);
            track.error.apply(null, args);
        };

        // --- check if index is in the range of these items

        var inRange = function(index){
            var errString = '"' + index + '" is not a valid index. Please use a integer between 0 and ' + total;

            if (isInteger(index)) {
                if (index < 0){
                    error(errString);
                    return false;
                } else if (index >= total) {
                    error(errString);
                    return false;
                } else {
                    return true;
                }
            } else {
                error(errString);
                return false;
            }
        };

        // --- insert an item

        var insertItem = function(newItem, index) {

            if ((newItem !== null) && ((typeof newItem === "string") || (typeof newItem === "object"))) {

                if (!inRange(index)){ index = total-1; } // no index insert at end

                var temp  = $('<div/>').append(newItem);   
                var addedItem = temp.children();       
                addedItem.addClass(CLASS_ITEM).attr("tabindex", 0);

                if (index === total-1) {
                    addedItem.insertAfter(items[total-1]);
                    index++; // for scroll
                } else {
                    addedItem.insertBefore(items[index]);
                }
                updateItems();
                scrollToItem(index); // scroll to items inserted
            } else {
                error("Unable to insert that kind of item. Please use a string or jquery object");
                return false;
            }
        };

        // --- remove an item based on index

        var removeItem = function(indexStart, indexEnd) {

            var removeThese = function(someItems){

                var fadeDone = function(){
                    someItems.remove(); 
                    updateItems();
                };
                if (useVelocity) {
                    $(someItems).velocity("fadeOut", { duration: 250, complete: fadeDone });
                } else {
                    $(someItems).fadeOut( "fast", fadeDone );
                }
            };

            if (inRange(indexStart)){
                if (indexEnd && inRange(indexEnd)) { 
                    if (indexEnd === indexStart) {
                        removeThese($(items[indexStart]));
                    } else {
                        if (indexEnd < indexStart) { // passed in indexes in wrong order, swap
                            var tempIndex = indexEnd;
                            indexEnd = indexStart;
                            indexStart = tempIndex;
                        }
                        var removeTheseItems = $();
                        for (var q = indexStart; q <= indexEnd; q++) {
                            removeTheseItems = removeTheseItems.add(items[q]);
                        }
                        removeThese(removeTheseItems);

                    }
                } else {
                    removeThese($(items[indexStart]));
                }
            } 
        };

        // --- toggle prev and next controls

        var setState = function(){   
            if (atStart) {
                prev.prop("disabled", true);
                if (next.prop("disabled")) { next.prop("disabled", false); }
            } else if (atEnd){
                next.prop("disabled", true);
                if (prev.prop("disabled")) { prev.prop("disabled", false); }
            } else {
                if (prev.prop("disabled")) { prev.prop("disabled", false); }
                if (next.prop("disabled")) { next.prop("disabled", false); }
            }
        };

        // --- toggle on the dots that are visible;

        var updateDots = function(selectedDots){
            dots.removeClass(settings.onClass);
            var toggleSelectedDot = function(dotIndex){
                var index = setItems.indexOf(dotIndex);
                $(dots[index]).addClass(settings.onClass);
            };
            selectedDots.forEach(toggleSelectedDot);
        };

        // --- fix the clones to be a real index

        var getShowing = function(cloneIndex){
            if (cloneIndex) { return showing; }

            var fixShowing = showing.map(function(i){
                if (i < 0) { return total + i; } 
                else if (i >= total) { return total - i; } 
                else { return i; }
            });

            return fixShowing;
        };
            
        // --- update record on what is actually shown on screen

        var updateShowing = function(){
            onCloneStart = false;      
            onCloneEnd = false; 
            atStart = false;
            atEnd = false;

            var selectedDots = [];

            for (var k = 0; k < settings.show; k++){
                showing[k] = current + k;
                if (showing[k] <= 0) { atStart = true; } // showing first item
                if (showing[k] >= total-1 ) { atEnd = true; } // showing last item
                if (showing[k] < 0 ) { onCloneStart = true; } 
                if (showing[k] > total-1 ) { onCloneEnd = true; } 
            }

            if (settings.useDots && setItems.length) {
                var fixedShowing = getShowing(); // no clones
                for (var j = 0; j < settings.show; j++){
                    if (inArray(setItems, fixedShowing[j])){
                        selectedDots.push(fixedShowing[j]);
                    }
                }
                updateDots(selectedDots);
            }
        };

        // --- scroll the actual slider

        var scrollSlider = function(newParams){
            var params = {
                axis: axis, 
                container: clipPane,
                duration: settings.speed, 
                easing: settings.easing
            };
            $.extend(params, newParams); // update settings

            if (useVelocity) {
                slider.velocity('scroll', params);
            } else {
                var scrollProp = { scrollTop: params.offset };
                if (settings.sideways) { scrollProp ={ scrollLeft: params.offset }; } 
                clipPane.animate( scrollProp, params.duration, params.easing, params.complete );
            }
        };

        // --- replace slider at the start with end clone

        var replaceWithEnd = function(){
            animating = true;
            current = total + current;                  // find current in end clone
            alreadyMoved = settings.show + current;     
            scrollSlider({ duration: 0, offset: alreadyMoved * one.totalSize });
            updateShowing(); 
            animating = false;
        };

        // --- replace slider at the end with the start clone (infinite reached end)

        var replaceWithStart = function(cloneOffset){
            animating = true;
            current = showing[0] - total;           // current is first in view
            alreadyMoved = settings.show + current; // ALREADY SCROLLED is clone count subtract curernt clone
            scrollSlider({ duration: 0, offset: alreadyMoved * one.totalSize });
            updateShowing();
            animating = false;
        };

        // --- scrolling animation complete from scrollToItem

        var doneScrolling = function(itemIndex){

            if (isInteger(itemIndex)) {
                current = itemIndex;
            } else {
                current = current + direction * scrollBy; // update new current
            }       
            alreadyMoved += direction * scrollBy; // update how far we scrolled

            updateShowing(); 

            // --- infinite scroll shenanigans

            if (settings.infinite) {
                if (onCloneStart) {
                    direction = -1;
                    replaceWithEnd();
                } else if (onCloneEnd) {
                    direction = 1;
                    replaceWithStart();
                }

            // --- non infinite scroll

            } else {
                setState(); // non infinite, check if we disable prev or next
            }

            animating = false; // lockdown ends now everything is processed
            console.log("===========================", showing, " current ", current);
        };

        // --- calculate the scroll

        var scrollToItem = function(itemIndex){
            animating = true;
    
            if (isInteger(itemIndex)) {      

                // --- scrolling to an item index 

                var firstCurrent = getShowing()[0]; // get first item showing
                if (firstCurrent === itemIndex) {
                    error(itemIndex, " is currently shown.");
                    return false;
                } else if (firstCurrent > itemIndex){ 
                    direction = -1; 
                    scrollBy = firstCurrent - itemIndex; // scroll backwards
                } else {  
                    if (!settings.infinite && (itemIndex > firstOfEnd)) {  
                        itemIndex = firstOfEnd;  
                    }
                    direction = 1; 
                    scrollBy = itemIndex - firstCurrent; 
                }

            } else {

                // ---- only none infinite scroll needs a range fix

                if (settings.infinite) {
                    scrollBy = settings.scroll;
                } else {
                    var destination = settings.scroll * direction + alreadyMoved; 
                    if (destination > firstOfEnd) { 
                        scrollBy = settings.scroll - (destination - firstOfEnd);     
                    } else if (destination < 0) {
                        scrollBy = settings.scroll + destination;  
                    } else {
                        scrollBy = settings.scroll;
                    }
                }
            }

            var params = {
                offset: direction * scrollBy * one.totalSize + alreadyMoved * one.totalSize,
                complete: doneScrolling.bind(this, itemIndex)
            };

            scrollSlider(params);
        };

        // --- since this is coming from api, validate item index is legit before moving

        var validateThenMove = function(itemIndex){
            if (inRange(itemIndex)) {
                scrollToItem(itemIndex);
                return true;
            } else {
                return false;
            }
        };

        // -- move to previous scroll

        var moveToPrev = function(e){
            if (e) { e.preventDefault(); }
            if ((atStart && !settings.infinite) || animating) { return false; }

            direction = -1;
            if (onCloneStart){ replaceWithEnd(); } 
            scrollToItem();
        };

        // --- move to next scroll

        var moveToNext = function(e){
            if (e) { e.preventDefault(); }
            if ((atEnd && !settings.infinite) || animating) { return false; }

            direction = 1;
            if (onCloneEnd){
                replaceWithStart(); // cant go prev as we are on a clone, replace
            } 
            scrollToItem();
        };

        // --- start auto play

        var startAutoPlay = function(){
            if (timer) { clearTimeout(timer); }
            timer = setTimeout(autoPlayed, settings.autoDuration);
        };

        // --- stop auto play

        var stopAutoPlay = function(){
            if (timer) { clearTimeout(timer); }    
        };

        // --- auto play moved once

        var autoPlayed = function(){
            if (!paused) { moveToNext(); }
            if (playing) { startAutoPlay(); }
        };

        // --- toggle play or auto

        var toggleAuto = function(){
            playing = !playing;
            if (playing) {
                if (settings.usePausePlay && play) {
                    play.prop("disabled", true).hide();
                    pause.prop("disabled", false).show().focus();
                }
                startAutoPlay();
            } else {
                if (settings.usePausePlay && play) {
                    pause.prop("disabled", true).hide();
                    play.prop("disabled", false).show().focus();
                }
                stopAutoPlay(); 
            }
        };

        // --- a key event we care about happened

        var handleKeyPress = function(keyCode){
            if (keyCode === settings.keyBack) { moveToPrev(); }
            if (keyCode === settings.keyForward) { moveToNext(); }
            if (keyCode === settings.keyToggle) { toggleAuto(); }
        };

        // --- setup hover triggered actions

        var setupHover = function(){

            var onTimer = null, offTimer = null;

            var onTasks = function(){
                if (settings.controlOnHover) { controls.removeClass(CLASS_INVIS); }
                if (settings.dotsOnHover) { navi.removeClass(CLASS_INVIS); }
                paused = true;
            };

            var offTasks = function(){
                if (settings.controlOnHover) { controls.addClass(CLASS_INVIS).blur(); }
                if (settings.dotsOnHover) { navi.addClass(CLASS_INVIS).blur(); }
                paused = false;
            };

            var cancelHoverTasks = function(){
                if (onTimer) { clearTimeout(onTimer); }
                if (offTimer) { clearTimeout(offTimer); }
            };

            var hoverOn = function(){ 
                cancelHoverTasks();
                onTimer = setTimeout(onTasks, DEBOUNCE_RATE);
            };

            var hoverOff = function(){ 
                cancelHoverTasks();
                offTimer = setTimeout(offTasks, DEBOUNCE_RATE);
            };

            offTasks();
            scope.hover(hoverOn, hoverOff);
        };

        // --- create the previous and next buttons and attach events

        var setupPreNext = function(){
            var prevIcon = $('<span/>', { 'class' : settings.prevIconClass, 'aria-hidden': 'true' });
            var nextIcon = $('<span/>', { 'class' : settings.nextIconClass, 'aria-hidden': 'true' });
            var prevContent = $('<span/>', { 'class' : CLASS_ACCESS_TEXT, 'text': settings.prevText });
            var nextContent = $('<span/>', { 'class' : CLASS_ACCESS_TEXT, 'text': settings.nextText });
            prev = $('<button/>', { 'class': settings.prevClass });
            next = $('<button/>', { 'class': settings.nextClass });
            prev.append(prevIcon).append(prevContent);
            next.append(nextContent).append(nextIcon);

            if (atStart && !settings.infinite) { prev.prop("disabled", true); }
            
            prev.click(moveToPrev);
            next.click(moveToNext);

            scope.prepend(next).prepend(prev);
            controls = controls.add(prev).add(next);
        };

        // --- make pause and play buttons

        var setupPausePlay = function(){
            var pauseIcon = $('<span/>', { 'class' : settings.pauseIconClass, 'aria-hidden': 'true' });
            var playIcon = $('<span/>', { 'class' : settings.playIconClass, 'aria-hidden': 'true' });
            var pauseContent = $('<span/>', { 'class' : CLASS_ACCESS_TEXT, 'text': settings.pauseText });
            var playContent = $('<span/>', { 'class' : CLASS_ACCESS_TEXT, 'text': settings.playText });
            pause = $('<button/>', { 'class': settings.pauseClass });
            play = $('<button/>', { 'class': settings.playClass });
            pause.append(pauseIcon).append(pauseContent);
            play.append(playIcon).append(playContent);
            var toggleSet = $().add(play).add(pause);

            var blurToggleSet = function(){ toggleSet.blur(); };

            play.click(toggleAuto);
            pause.click(toggleAuto);

            toggleSet.mouseleave(blurToggleSet);

            scope.prepend(pause).prepend(play);
            controls = controls.add(play).add(pause);
        };

        // --- a dot has been clicked, go to that item

        var goToDotItem = function(e){
            if (e) { e.preventDefault(); }
            var dotEnum = $(this).data(DATA_ENUM);
            if (current === dotEnum) { return false; }
            scrollToItem(dotEnum);  
            dots.removeClass(CLASS_ON);
            $(this).addClass(CLASS_ON);
        };

        // --- setup dots

        var setupDots = function(){
            var existingNavi = $("." + CLASS_NAVI, scope);
            if (existingNavi.length) { existingNavi.remove(); }
            setItems = []; // empty
            navi = $('<ol/>', { 'class': CLASS_NAVI });
            var prevItem = null;
            
            for (var z=0; z < sets; z++){
                var relatedItem = z * settings.scroll;
                if (relatedItem > firstOfEnd) { relatedItem = firstOfEnd; }
                if (prevItem !== relatedItem) {

                    var listItem = $('<li/>', { 'class': settings.dotClass });
                    var dot = $('<button/>', { 'class': settings.dotButtonClass });
                    var dotIcon = $('<span/>', { 'class' : settings.dotIconClass, 'aria-hidden': 'true' });
                    var dotContent = $('<span/>', { 'class' : CLASS_ACCESS_TEXT, 'text': settings.dotText + z });

                    dot.data(DATA_ENUM, relatedItem).append(dotIcon).append(dotContent);
                    dot.click(goToDotItem);
                    listItem.append(dot);
                    navi.append(listItem);
                    setItems.push(relatedItem);
                    prevItem = relatedItem;
                }
            }
            dots = $("." + CLASS_DOT_BTN, navi);
            scope.prepend(navi);
            updateShowing(); 
        };

        // --- disable all controls

        var disableControls = function(){
            if (settings.usePrevNext || settings.usePausePlay) { controls.prop("disabled", true); }
            if (settings.useDots) { dots.prop("disabled", true); }
        };

        // --- enable all controls

        var enableControls = function(){
            if (settings.usePrevNext || settings.usePausePlay) { controls.prop("disabled", false); }
            if (settings.useDots) {  dots.prop("disabled", false); }
        };

        // -- create icon prev and next buttons

        var createControls = function(){
            if (settings.usePrevNext) { setupPreNext(); }
            
            if (settings.key){
                var keyArray = [ settings.name ];
                if (settings.usePrevNext) {
                    keyArray.push(settings.keyBack);
                    keyArray.push(settings.keyForward);
                }
                if (settings.usePausePlay) {
                    keyArray.push(settings.keyToggle);
                }
                track.subscribeKey(keyArray);
            }

            if (settings.useDots){ setupDots(); } 

            if (settings.auto) { 
                if (settings.usePausePlay) { setupPausePlay(); }
                toggleAuto();
            } 

            if (!track.touch){ setupHover(); }
        };

        // --- return attributes on some jquery element

        var getAttributes = function(jqElement){
            var attrs = {}; // 
            $.each(jqElement[0].attributes, function(id, attr){
                attrs[attr.nodeName] = attr.nodeValue;
            });
            return attrs;
        };

        // --- calculate the size and offset for one item (jq obj)

        var getTrueItemSize = function(item){
            var calcOffset = 0;
            if (settings.sideways){
                var m1 = parseInt(item.css("margin-left"), 10),
                    m2 = parseInt(item.css("margin-right"), 10);
                calcOffset = m1 + m2;
            } else {
                var m3 = parseInt(item.css("margin-top"), 10),
                    m4 = parseInt(item.css("margin-bottom"), 10);
                calcOffset = m3 + m4;
                // calcOffset = (m3 > m4) ? m3 : m4;                   // take largest margin bc of margin-collapse
                // scope.css("height", height + calcOffset + "px");    // bc of collapse we need to increase height...
            }
            if ($(item).css("box-sizing") === "content-box") {
                if (settings.sideways){
                    var b1 = parseInt(item.css("border-left-width"), 10),
                        b2 = parseInt(item.css("border-right-width"), 10);
                    calcOffset += b1 + b2;
                } else {
                    var b3 = parseInt(item.css("border-top-width"), 10),
                        b4 = parseInt(item.css("border-bottom-width"), 10);
                    calcOffset += b3 + b4;
                }
            } 
            return {
                w: item.outerWidth(true),
                h: item.outerHeight(true),
                offset: calcOffset
            };
        };

        // --- set the size of items based on passed in size

        var setItemsSize = function(){
            var size = settings.sideways ? width/settings.show : height/settings.show;

            one.totalSize = size;
            one.size = size - one.offset; // make room for margin/border
            items.css(adjustProperty, one.size + "px");
        };

        // --- set the size of the slider holding the items 

        var setSliderSize = function(){
            var sliderItems = total;

            if (settings.infinite){
                clones.css(adjustProperty, one.size + "px");
                sliderItems += settings.show * 2; // make room for clones
            }
            slider.css(adjustProperty, one.totalSize * sliderItems + "px"); // set length of slider
        };

        // --- adjust the size of the items and the slider 

        var adjustItemSize = function(){  
            setItemsSize();
            setSliderSize();
        };

        // --- resize happened, recalculate

        var resizeCarrot = function(){
            setClipSize();
            adjustItemSize();

            if (settings.infinite){
                scrollSlider({ duration: 0, offset: (current + settings.show) * one.totalSize});
            } else {
                if (showing[0] === 0) {
                    return false; // do nothing since at start 
                } else {
                    scrollSlider({ duration: 0, offset: current * one.totalSize}); // move slider
                }
            }
        };

        // --- make clones for infinite scroll

        var createClones = function(){

            $("." + CLASS_CLONE, slider).remove();

            var endSlice = items.slice(-1*settings.show).clone(),
                startSlice = items.slice(0, settings.show).clone();

            endSlice.addClass(CLASS_CLONE).attr("tabindex", -1);
            startSlice.addClass(CLASS_CLONE).attr("tabindex", -1);

            items.filter(':first').before(endSlice);         
            items.filter(':last').after(startSlice);

            items = $("." + CLASS_ITEM + ":not(."+ CLASS_CLONE + ")", scope); 
            clones = $("." + CLASS_CLONE, scope);

            alreadyMoved = settings.show;
        };

        // --- figure out how many sets and the last item is

        var calcFromTotal = function(){
            sets = Math.ceil(total/settings.scroll);
            firstOfEnd = total - settings.show; // the first item in the ending view
            updateShowing();
            if (sets > 1) { enoughToScroll = true; }

            console.log("sets ", sets, " first of end ", firstOfEnd, " total ", total, " show ", settings.show, showing);
        };

        // --- items has changed, update 

        var updateItems = function(){
            items = $("." + CLASS_ITEM + ":not(."+ CLASS_CLONE + ")", slider);

            total = items.length;
            console.log("now there is ", total, " items ");


            adjustItemSize(); 
            calcFromTotal(); // recalculate the sets and what is end slice

            console.log("UPDATE ", total, " showing ", settings.show);
            if (total > settings.show) {
                enableControls();
                if (settings.useDots) { setupDots(); } // rebuild the dot list
                if (settings.infinite) { createClones(); } // recreate clones
            } else {
                disableControls();
            }
        };

        // --- set the size of the clipping pane 

        var setClipSize = function(){
            width = parseInt(Math.floor(scope.width()), 10);
            height = parseInt(Math.floor(scope.height()), 10);

            clipPane.css(adjustProperty, width + "px");
        };

        // --- make the html frame depending on if its a list or divs

        var makeFrame = function(){ 

            clipPane = $('<div/>', { 'class': CLASS_CLIP });
            setClipSize();
                
            var sliderType = '<div/>';
            var carrotType = scope.prop('tagName').toUpperCase();
            var isList = false;

            if (carrotType === "UL" || carrotType === "OL"){ 
                isList = true; 
                sliderType = '<'+ carrotType + '/>';
            }

            slider = $(sliderType, { 'class': CLASS_SLIDER });

            items.appendTo(slider);
            slider.appendTo(clipPane); 

            if (isList) {
                var dupeAttributes = getAttributes(scope);
                var newParent = $('<div/>', dupeAttributes);
                clipPane.appendTo(newParent);
                scope.replaceWith(newParent);
                scope = newParent;
            } else {
                scope.empty();
                clipPane.appendTo(scope);
            }

            items.addClass(CLASS_ITEM).attr("tabindex", 0);
            scope.addClass(ROOT).data(ROOT, settings.name);   

            if (!settings.sideways) {
                scope.addClass(CLASS_VERTICAL);
            }

            if (settings.infinite){ createClones(); }  // pad with clones

            one = getTrueItemSize($(items[0])); // the size of one item

            adjustItemSize();   // make the items fit inside the clippane  

            // if its infinite, move items out of view

            if (settings.infinite){
                scrollSlider({ duration: 0, offset: settings.show * one.totalSize }); 
            }
        };

        // --- update the settings object 

        var updateSettings = function(){
            if (settings.show < settings.scroll){
                settings.scroll = settings.show;
                error("sorry, you cant scroll more items than whats actually showing.");
            }

            if (!useVelocity && ($.easing[settings.easing] === undefined)) {
                error(settings.easing, " is not supported, please include a jquery easing plugin or velocity");
                settings.easing = "swing";
            }

            if (settings.sideways) { axis = "x"; } else { axis = "y"; }

            if (settings.auto) {  settings.infinite = true; }

            if (settings.key) {
                if (settings.sideways) {
                    settings.keyBack = settings.keyBack || KEY_BACK;
                    settings.keyForward = settings.keyForward || KEY_FORWARD;
                } else {
                    settings.keyBack = settings.keyBack || KEY_UP;
                    settings.keyForward = settings.keyForward || KEY_DOWN;
                }
            }

            if (settings.usePrevNext) {
                settings.prevClass = CLASS_BTN + ' ' + CLASS_PREV + ' ' + settings.prevClass;
                settings.nextClass = CLASS_BTN + ' ' + CLASS_NEXT + ' ' + settings.nextClass;
                settings.prevIconClass = CLASS_ICON + ' ' + settings.prevIconClass;
                settings.nextIconClass = CLASS_ICON + ' ' + settings.nextIconClass;
            }

            if (settings.usePausePlay) {
                settings.pauseClass = CLASS_BTN + ' ' + CLASS_PAUSE + ' ' + settings.pauseClass;
                settings.playClass = CLASS_BTN + ' ' + CLASS_PLAY + ' ' + settings.playClass;
                settings.pauseIconClass = CLASS_ICON + ' ' + settings.pauseIconClass;
                settings.playIconClass = CLASS_ICON + ' ' + settings.playIconClass;
            }
            
            if (settings.useDots) {
                settings.naviClass = CLASS_NAVI + ' ' + settings.naviClass;
                settings.dotClass = CLASS_DOT + ' ' + settings.dotClass;
                settings.dotButtonClass = CLASS_BTN + ' ' + CLASS_DOT_BTN + ' ' + settings.dotButtonClass;
            }
        };

        // --- get information about this carrotcell

        var getInfo = function(){
            items = scope.children(); 
            total = items.length;
            useVelocity = $(scope).velocity === undefined ? false : true;
            adjustProperty = settings.sideways ? "width" : "height";
        };

        // --- setup the carrot

        setup = function(){
            getInfo();          // find information on this carrotcell
            updateSettings();   // toggle on relevant settings if any
            makeFrame();        // make the markup
            
            if ((total > settings.show) && (total > 1)) {
                calcFromTotal();    
                createControls();   
            } 
        };

        /** ---------------------------------------
            carrot public api
        */
        var API_Methods = {

            // --- initialize the carrot

            init : function(options){
                scope = options.scope;
                $.extend(settings, options); // update settings
                setup();
            },

            // --- update the carrot with new options

            update : function(options) {
                $.extend(settings, options);
                // setup();
                // remake controls but dont remake the frame
            },

            // --- insert an item

            insert : function(newItem, insertIndex) { return insertItem(newItem, insertIndex); },

            // --- remove an item

            remove : function(removeStart, removeEnd) { return removeItem(removeStart, removeEnd); },

            // --- the window has changed sizes

            resize : function(){ resizeCarrot(); },

            // --- track triggers this

            keyPressed : function(keyCode){ handleKeyPress(keyCode); },

            // --- move the carousel to an index

            moveToItem : function(itemIndex) { validateThenMove(itemIndex); },

            // --- return STR the name of this carrot

            getName : function(){ return settings.name; },

            // --- return INT how many items are in the carrotcell

            getCount : function() { return total; },

            // --- return ARRAY of INT, with clone index if TRUE

            getShowing : function(cloneIndex) { return getShowing(cloneIndex); },

            // --- return current INT index

            getFirstShowing : function(cloneIndex){ return getShowing(cloneIndex)[0]; }
        };

        return API_Methods;
    };

    /** ---------------------------------------
        keep track of all the carrot cells
    */
    var track = {
        carrots : {},   // track all the carrotcells by name
        keys : {},      // key events subscribed to by carrots
        count : 0,      // count carrot cells made
        initialized: false,
        useKey: false,
        touch: false,

        // --- log carrotcell errors

        error : function(){
            var args = Array.prototype.slice.call(arguments);
            args.unshift("[ CARROTCELL ERROR ]");
            console.log.apply(null, args);
        },
                
        // --- trigger some function on all carrots

        triggerCarrots : function(someFunc){
            for (var i in track.carrots) {
                if (typeof track.carrots[i][someFunc] === "function"){
                    track.carrots[i][someFunc]();
                }
            }
        },

        // --- carrots call this to subscribe keys

        subscribeKey : function(keyArray){
            if (!track.useKey){ 
                $(window).keyup(track.keyPressed);
                track.useKey = true;
            }
             
            var carrotName = keyArray.shift();

            keyArray.forEach(function(subkey){
                if (subkey in track.keys){
                    track.keys[subkey].push(carrotName);
                } else {
                    track.keys[subkey] = [carrotName];
                }
            });
        },

        // --- a key has been pressed, tell the subbed carrots

        keyPressed : function(e){
            if (e.keyCode in track.keys) {
                track.keys[e.keyCode].forEach(function(subbedCarrot){
                    track.carrots[subbedCarrot].keyPressed(e.keyCode);
                });
            } 
        },
        
        // --- window reized, trigger resize on all carrotcells

        windowResized : debounce(function(){ track.triggerCarrots("resize"); }, DEBOUNCE_RATE),

        // --- initialize jcarousel object, note THIS is not track object

        makeCarrot : function(options) {  
            track.count++;
            if (!options) { options = {}; }     // passed in carrotcell options
            options.userOptions = JSON.stringify(options);      // save user passed options

            options.scope = $(this);            // save this element as the scope
            options.name = "carrot-" + track.count + "-" + options.scope.attr("id"); 
            var newCarrot = new carrot();
            track.carrots[options.name] = newCarrot; 
            newCarrot.init(options);

            return newCarrot; // return api
        },

        // --- init the tracking object

        init : function(){
            $(window).on('resize', track.windowResized);
            if (('ontouchstart' in window) || (window.DocumentTouch && document instanceof DocumentTouch)){
                track.touch = true; // is this touch device?
            }
            track.initialize = true;
        }
    };
    
    /** ---------------------------------------
        add carrotCell as a jquery function
    */
    $.fn.carrotCell = function() {

        if (this.length === 0) {
            track.error("Nothing to call CarrotCell on, check your jquery selector.");
            return false;
        }

        if (!track.initialize) { track.init(); } // first time carrotcelling

        var carrotAPI = $(this).data(DATA_API); // is this already a carrotcell?
        if (carrotAPI) {
            carrotAPI.update.apply(this, arguments); // update with new params
            return carrotAPI;
        } else {
            var newCarrot = track.makeCarrot.apply(this, arguments);
            var newCarrotName = newCarrot.getName();
            track.carrots[newCarrotName] = newCarrot;
            $(this).data(DATA_API, newCarrot); // save the api on this element...
            return newCarrot;
        }      
    };
})(jQuery);
