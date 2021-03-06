/*	Copyright (c) 2015 Jean-Marc VIGLINO, 
	released under the CeCILL-B license (French BSD license)
	(http://www.cecill.info/licences/Licence_CeCILL-B_V1-en.txt).
*/

import ol from 'ol'
import ol_control_Control from 'ol/control/control'
import ol_proj from 'ol/proj'

/**
 * Permalink Control.    
 * 
 *	Add a `permalink`property to layers to be handled by the control (and added in the url). 
 *  The layer's permalink property is used to name the layer in the url.
 *	The control must be added after all layer are inserted in the map to take them into acount.
 *
 * @constructor
 * @extends {ol_control_Control}
 * @param {Object=} options
 *	@param {bool} options.urlReplace replace url or not, default true
 *	@param {integer} options.fixed number of digit in coords, default 6
 *	@param {bool} options.anchor use "#" instead of "?" in href
 *	@param {function} options.onclick a function called when control is clicked
 */
var ol_control_Permalink = function(opt_options)
{	var options = opt_options || {};
	var self = this;
	
	var button = document.createElement('button');
	this.replaceState_ = (options.urlReplace!==false);
	this.fixed_ = options.fixed || 6;
	this.hash_ = options.anchor ? "#" : "?";

	function linkto()
	{	if (typeof(options.onclick) == 'function') options.onclick(self.getLink());
		else self.setUrlReplace(!self.replaceState_);
	}
    button.addEventListener('click', linkto, false);
    button.addEventListener('touchstart', linkto, false);

	var element = document.createElement('div');
    element.className = (options.className || "ol-permalink") + " ol-unselectable ol-control";
    element.appendChild(button);
    
	ol_control_Control.call(this,
	{	element: element,
		target: options.target
	});

	this.on ('change', this.viewChange_, this);

	// Save search params
	this.search_ = {};
	var hash = document.location.hash || document.location.search;
	if (hash)
	{	hash = hash.replace(/(^#|^\?)/,"").split("&");
		for (var i=0; i<hash.length;  i++)
		{	var t = hash[i].split("=");
			switch(t[0])
			{	case 'lon':
				case 'lat':
				case 'z':
				case 'r':
				case 'l': break;
				default: this.search_[t[0]] = t[1];
			}
		}
	}
	
	// Decode permalink
	this.setPosition();
};
ol.inherits(ol_control_Permalink, ol_control_Control);

/**
 * Set the map instance the control associated with.
 * @param {ol.Map} map The map instance.
 */
ol_control_Permalink.prototype.setMap = function(map)
{   if (this.getMap())
	{	this.getMap().getLayerGroup().un('change', this.layerChange_, this);
		this.getMap().un('moveend', this.viewChange_, this);
	}

	ol_control_Control.prototype.setMap.call(this, map);
	
	// Get change 
	if (map) 
	{	map.getLayerGroup().on('change', this.layerChange_, this);
		map.on('moveend', this.viewChange_, this);
		this.setPosition();
	}
};

/** Get layer given a permalink name (permalink propertie in the layer)
*	@param {string} the permalink to search for
*	@param {Array<ol.layer>|undefined} an array of layer to search in
*	@return {ol.layer|false}
*/
ol_control_Permalink.prototype.getLayerByLink =  function (id, layers)
{	if (!layers && this.getMap()) layers = this.getMap().getLayers().getArray();
	for (var i=0; i<layers.length; i++)
	{	if (layers[i].get('permalink') == id) return layers[i];
		// Layer Group
		if (layers[i].getLayers)
		{	var li = this.getLayerByLink ( id, layers[i].getLayers().getArray() );
			if (li) return li;
		}
	}
	return false;
}

/** Set map position according to the current link 
*/
ol_control_Permalink.prototype.setPosition = function()
{	var map = this.getMap();
	if (!map) return;

	var hash = document.location.hash || document.location.search;
	if (!hash) return;
	
	var param = {};
	hash = hash.replace(/(^#|^\?)/,"").split("&");
	for (var i=0; i<hash.length;  i++)
	{	var t = hash[i].split("=");
		param[t[0]] = t[1];
	}
	var c = ol_proj.transform([Number(param.lon),Number(param.lat)], 'EPSG:4326', map.getView().getProjection());
	if (c[0] && c[1]) map.getView().setCenter(c);
	if (param.z) map.getView().setZoom(Number(param.z));
	if (param.r) map.getView().setRotation(Number(param.r));

	if (param.l)
	{	var l = param.l.split("|");

		// Reset layers 
		function resetLayers(layers)
		{	if (!layers) layers = map.getLayers().getArray();
			for (var i=0; i<layers.length; i++)
			{	if (layers[i].get('permalink')) 
				{	layers[i].setVisible(false);
					// console.log("hide "+layers[i].get('permalink'));
				}
				if (layers[i].getLayers)
				{	resetLayers (layers[i].getLayers().getArray());
				}
			}
		}
		resetLayers();

		for (var i=0; i<l.length; i++)
		{	var t = l[i].split(":");
			var li = this.getLayerByLink(t[0]);
			var op = Number(t[1]);
			if (li) 
			{	li.setOpacity(op);
				li.setVisible(true);
			}
		}
	}
}


/**
 * Get the parameters added to the url. The object can be changed to add new values.
 * @return {Object} a key value object added to the url as &key=value
 * @api stable
 */
ol_control_Permalink.prototype.getUrlParams = function()
{	return this.search_;
}

/**
 * Get the permalink
 * @return {permalink}
 */
ol_control_Permalink.prototype.getLink = function()
{	var map = this.getMap();
	var c = ol_proj.transform(map.getView().getCenter(), map.getView().getProjection(), 'EPSG:4326');
	var z = map.getView().getZoom();
	var r = map.getView().getRotation();
	var l = this.layerStr_;
	// Change anchor
	var anchor = "lon="+c[0].toFixed(this.fixed_)+"&lat="+c[1].toFixed(this.fixed_)+"&z="+z+(r?"&r="+(Math.round(r*10000)/10000):"")+(l?"&l="+l:"");

	for (var i in this.search_) anchor += "&"+i+"="+this.search_[i];

	//return document.location.origin+document.location.pathname+this.hash_+anchor;
	return document.location.protocol+"//"+document.location.host+document.location.pathname+this.hash_+anchor;
}

/**
 * Enable / disable url replacement (replaceSate)
 *	@param {bool}
 */
ol_control_Permalink.prototype.setUrlReplace = function(replace)
{	try{
		this.replaceState_ = replace;
		if (!replace) 
		{	var s = "";
			for (var i in this.search_)
			{	s += (s==""?"?":"&") + i+"="+this.search_[i];
			}
			window.history.replaceState (null,null, document.location.origin+document.location.pathname+s);
		}
		else window.history.replaceState (null,null, this.getLink());
	}catch(e){}
}


/**
 * On view change refresh link
 * @param {ol.event} The map instance.
 * @private
 */
ol_control_Permalink.prototype.viewChange_ = function()
{	try{
		if (this.replaceState_) window.history.replaceState (null,null, this.getLink());
	}catch(e){}
}

/**
 * Layer change refresh link
 * @param {ol.event} The map instance.
 * @private
 */
ol_control_Permalink.prototype.layerChange_ = function(e)
{	// Get layers
	var l = "";
	function getLayers(layers)
	{	for (var i=0; i<layers.length; i++)
		{	if (layers[i].getVisible() && layers[i].get("permalink"))
			{	if (l) l += "|";
				l += layers[i].get("permalink")+":"+layers[i].get("opacity");
			}
			// Layer Group
			if (layers[i].getLayers) getLayers(layers[i].getLayers().getArray());
		}
	}
	getLayers(this.getMap().getLayers().getArray());
	this.layerStr_ = l;

	this.viewChange_();
}

export default ol_control_Permalink
