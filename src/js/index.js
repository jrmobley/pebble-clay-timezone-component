'use strict';
/*eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }]*/

var _ = require('underscore');
var moment = require('moment-timezone/moment-timezone.js');
require('moment-timezone/moment-timezone-utils.js');

function defaultOptions() {
  var packedData = require('moment-timezone/data/packed/latest.json')
  console.log('Timezone data version ' + packedData.version);

  var areaPattern = /[a-z]/;
  var areaMap = {};
  _.each(packedData.zones, function(packedZone) {
      
      /* Unpack the zone. */
      var zone = moment.tz.unpack(packedZone);

      /* Most zones are a named with a 'Area/Location' pattern.
        So we are going to have a pair of drop down lists: Area and Location.
        But there are a few zones with additional grouping, like:
        'America/Argentina/...' and 'America/Indiana/...'
        For these, everything after the Area is considered to be part of the Location. */
      var split = zone.name.indexOf('/');
      var area = zone.name.slice(0, split);
      var location = zone.name.slice(split + 1);

      /* There are some Areas that we don't want to show.
        I need to know more about why they are there, but we will
        ignore Area that does not contain lowercase letters. */
      if (! areaPattern.test(area)) {
          return;
      }
      
      /* Create an entry for the Location drop down.
        For the human readable label, replace underscores with
        spaces.  If that is different than the raw value, then
        also set the value for the option.  If the option lacks
        a value field, then the label will be used as the value. */
      var locationOption = {
          label: location.split('_').join(' ')
      };
      if (locationOption.label !== location) {
          locationOption.value = location;
      }

      if (_.has(areaMap, area)) {
          /* Add the Location to an existing Area. */
          areaMap[area].options.push(locationOption);
      } else {
          /* Add a new Area (with the Location) */
          var areaOption = {
              label: area,
              options: [
                  locationOption
              ]
          }
          areaMap[area] = areaOption;
      }
  });
  //console.log(JSON.stringify(areaMap, null, 2));
  return _.values(areaMap);
}

function initialize(minified, _clayConfig) {
  /* BIG FAT FUCKING WARNING!
     Do not attempt to use anything from outside this function, like underscore or module variables.
     This code is sent into the webpage and runs in that environment, which is not this environment.
     You have been warned. */

  var HTML = minified.HTML;
  var self = this; // type ClayItem

  var $elem = self.$element;
  var $areaSelect = $elem.select('select.tz-area');
  var $areaDisplay = $elem.select('span.tz-area');
  var $locationSelect = $elem.select('select.tz-location');
  var $locationDisplay = $elem.select('span.tz-location');

  /**
   * Sync the Area and Location selection drop-downs to the current
   * timezone value.
   * @return {void}
   */
  function syncSelects() {
    /* Split up the timezone value into Area and Location parts. */
    var timezone = self.get();
    var parts = timezone.split('/');
    var setArea = parts[0];
    var setLocation = parts.slice(1).join('/');

    /* Find the Area in the config options. */
    var areas = self.config.options;
    var area, areaIndex;
    for (areaIndex = 0; areaIndex < areas.length; ++areaIndex) {
      area = areas[areaIndex];
      if (setArea === (area.value || area.label)) {
        break;
      }
    }
    if (areaIndex === areas.length) {
      return;
    }    

    /* Find the Location in the Area options. */
    var locations = area.options;
    var location, locationIndex;
    for (locationIndex = 0; locationIndex < locations.length; ++locationIndex) {
      location = locations[locationIndex];
      if (setLocation === (location.value || location.label)) {
        break;
      }
    }
    if (locationIndex === locations.length) {
      return;
    }

    /* Configure the select elements. */
    $areaSelect.set('selectedIndex', areaIndex);
    syncSelectDisplay($areaSelect, $areaDisplay);
    populateLocationSelect(area);
    $locationSelect.set('selectedIndex', locationIndex);
    syncSelectDisplay($locationSelect, $locationDisplay);
  }

  /**
   * @param {list} $select
   * @param {list} $display
   * @return {number} the selected index, for convenience.
   */
  function syncSelectDisplay($select, $display) {
    var selectedIndex = $select.get('selectedIndex');
    var $options = $select.select('option');
    var value = $options[selectedIndex] && $options[selectedIndex].innerHTML;
    $display.set('innerHTML', value);
    return selectedIndex;
  }

  /**
   * Populate the Location select with the options for the given Area.
   * Fires no events.
   * @param {object} area
   * @return {void}
   */
  function populateLocationSelect(area) {
    $locationSelect.set('innerHTML', '');
    area.options.forEach(function(location) {
      var tmplt = '<option class="{{className}}" value="{{value}}">' +
                  '{{label}}</option>"';
      var params = {
        className: 'item-select-option',
        label: location.label,
        value: location.value || location.label
      };
      var html = HTML(tmplt, params);
      $locationSelect.add(html);
    });
  }

  /**
   * This handler is attached to the 'change' event.
   * @return {void}
   */
  function areaChanged() {
    var areaIndex = syncSelectDisplay($areaSelect, $areaDisplay);
    var area = self.config.options[areaIndex];
    populateLocationSelect(area);
    $locationSelect.trigger('change');
  }

  /**
   * @return {void}
   */
  function locationChanged() {
    var areaIndex = $areaSelect.get('selectedIndex') || 0;
    var area = self.config.options[areaIndex];
    var locationIndex = syncSelectDisplay($locationSelect, $locationDisplay);
    var location = area.options[locationIndex];
    var value = (area.value || area.label) + '/' + (location.value || location.label);
    self.set(value);
  }

  self.on('change', syncSelects);
  $locationSelect.on('change', locationChanged);
  $areaSelect.on('change', areaChanged);
}

moment.tz.Zone.prototype.until = function(timestamp) {
  return this.untils[this._index(timestamp)];
}

function getTimezoneOffset(timezone, refreshFunc) {
  var now = Date.now();
  var zoneObject = moment.tz.zone(timezone);
  var zoneOffset = zoneObject.utcOffset(now);
  var offsetUntil = zoneObject.until(now);
  var offsetUntilStr = offsetUntil ? new Date(offsetUntil) : 'the universe goes cold.';
  console.log(timezone +
              ', offset ' + zoneOffset +
              ' (' + zoneObject.abbr(now) + ')' +
              ', until ' + offsetUntilStr);
  if (offsetUntil) {
      window.setTimeout(refreshFunc, offsetUntil - now);
  }
  return zoneOffset;
}

/*  Our module has two properties:
      options : an object to be included as the options property of any timezone component.
      component : the actual timezone component to be registered with clay.
    I think a better design would have been to supply the default options in the defaults
    property (as shown in comment below), but clay only supplies the default values to the HTML template
    expansion, and they are not available to the component in any other way, so we are forced into
    this design.  I looked into patching my fork clay, but the code is so antique now that I wasn't able
    to build a new version.  I'm sure somebody could do it, but I've got too far down this rabbit-
    hole already.
*/
module.exports = {
  options: defaultOptions(),
  component : {
    name: 'timezone',
    template: require('!raw!./template.html'),
    style: require('!raw!./template.css'),
    manipulator: 'val',
    /* defaults: { options: defaultOptions() }, */
    initialize: initialize
  },
  getTimezoneOffset: getTimezoneOffset
};
