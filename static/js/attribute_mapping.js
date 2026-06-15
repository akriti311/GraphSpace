/**
 * Visual Attribute Mapping — attribute discovery from graph_json.
 */
var attributeMapping = {
  RESERVED_NODE_ATTRS: [ 'id', 'name', 'label', 'aliases', 'popup', 'k', 'parent' ],
  RESERVED_EDGE_ATTRS: [ 'id', 'source', 'target', 'name', 'is_directed', 'popup', 'k' ],

  discoveredAttributes: null,

  init: function () {
    if ( typeof graph_json === 'undefined' || !graph_json ) {
      this.discoveredAttributes = { nodes: {}, edges: {} };
      return;
    }
    this.discoveredAttributes = this.extractAttributes( graph_json );
  },

  extractAttributes: function ( graphJson ) {
    if ( !graphJson || !graphJson.elements ) {
      return { nodes: {}, edges: {} };
    }

    return {
      nodes: this._scanElements( graphJson.elements.nodes, this.RESERVED_NODE_ATTRS ),
      edges: this._scanElements( graphJson.elements.edges, this.RESERVED_EDGE_ATTRS )
    };
  },

  _scanElements: function ( elements, reserved ) {
    var attrs = {};
    var self = this;

    _.each( elements || [], function ( el ) {
      _.each( el.data || {}, function ( value, key ) {
        if ( reserved.indexOf( key ) !== -1 ) {
          return;
        }
        if ( !attrs[ key ] ) {
          attrs[ key ] = { values: [] };
        }
        if ( value !== null && value !== undefined && value !== '' ) {
          attrs[ key ].values.push( value );
        }
      } );
    } );

    var result = {};
    _.each( attrs, function ( info, key ) {
      result[ key ] = self._classifyAttribute( info.values );
    } );
    return result;
  },

  _classifyAttribute: function ( values ) {
    var unique = _.uniq( values );
    var allNumeric = unique.length > 0 && _.every( unique, function ( v ) {
      return !isNaN( parseFloat( v ) ) && isFinite( v );
    } );

    if ( allNumeric ) {
      var nums = _.map( unique, parseFloat );
      return {
        type: 'numerical',
        min: _.min( nums ),
        max: _.max( nums ),
        count: values.length
      };
    }

    return {
      type: 'categorical',
      values: unique.sort(),
      count: values.length
    };
  },

  bindPanelEvents: function () {
    $( '#mapAttributesBtn' ).off( 'click' ).on( 'click', function ( e ) {
      e.preventDefault();
      attributeMapping.openPanel();
    } );

    $( '#backToLayoutEditorBtn' ).off( 'click' ).on( 'click', function ( e ) {
      e.preventDefault();
      attributeMapping.closePanel();
    } );
  },

  openPanel: function () {
    this.init();

    $( '.gs-sidebar-nav' ).removeClass( 'active' );
    $( '#attributeMappingSideBar' ).addClass( 'active' );
  },

  closePanel: function () {
    $( '.gs-sidebar-nav' ).removeClass( 'active' );
    $( '#layoutEditorSideBar' ).addClass( 'active' );
  }
};

if ( typeof graph_json !== 'undefined' && graph_json ) {
  attributeMapping.init();
}
