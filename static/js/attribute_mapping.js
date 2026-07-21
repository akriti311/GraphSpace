/**
 * Visual Attribute Mapping — attribute discovery from graph_json.
 */
var attributeMapping = {
  RESERVED_NODE_ATTRS: [ 'id', 'name', 'label', 'aliases', 'popup', 'k', 'parent' ],
  RESERVED_EDGE_ATTRS: [ 'id', 'source', 'target', 'name', 'is_directed', 'popup', 'k' ],

  discoveredAttributes: null,

  COLOR_VISUAL_PROPERTIES: [ 'background-color', 'line-color' ],

  DEFAULT_COLORS: [
    '#3366cc', '#dc3912', '#ff9900', '#109618',
    '#990099', '#0099c6', '#dd4477', '#66aa00'
  ],

  // Which visual properties support which mapping types.
  VISUAL_PROPERTIES: {
    node: [
      { id: 'background-color', label: 'Node color', discrete: true, continuous: true },
      { id: 'width', label: 'Node size', discrete: false, continuous: true },
      { id: 'shape', label: 'Node shape', discrete: true, continuous: false }
    ],
    edge: [
      { id: 'line-color', label: 'Edge color', discrete: true, continuous: true },
      { id: 'width', label: 'Edge width', discrete: false, continuous: true },
      { id: 'line-style', label: 'Edge style', discrete: true, continuous: false }
    ]
  },

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

    this.bindFormEvents();
  },

  bindFormEvents: function () {
    $( '#mappingElementType' ).off( 'change' ).on( 'change', function () {
      $( '#mappingMappingType' ).val( 'discrete' );
      attributeMapping.populateAttributeDropdown();
      attributeMapping.populateVisualPropertyDropdown();
      attributeMapping.updateMappingConfig();
    } );

    $( '#mappingAttribute' ).off( 'change' ).on( 'change', function () {
      attributeMapping.syncMappingTypeFromAttribute();
      attributeMapping.updateMappingConfig();
    } );

    $( '#mappingMappingType' ).off( 'change' ).on( 'change', function () {
      attributeMapping.populateVisualPropertyDropdown();
      attributeMapping.updateMappingConfig();
    } );

    $( '#mappingVisualProperty' ).off( 'change' ).on( 'change', function () {
      attributeMapping.updateMappingConfig();
    } );
  },

  getSelectedElementType: function () {
    var elementType = $( '#mappingElementType' ).val();
    return elementType === 'edge' ? 'edge' : 'node';
  },

  getSelectedMappingType: function () {
    return $( '#mappingMappingType' ).val() === 'continuous' ? 'continuous' : 'discrete';
  },

  getVisualPropertiesForSelection: function () {
    var elementType = this.getSelectedElementType();
    var mappingType = this.getSelectedMappingType();
    var properties = this.VISUAL_PROPERTIES[ elementType ] || [];

    return _.filter( properties, function ( property ) {
      return mappingType === 'continuous' ? property.continuous : property.discrete;
    } );
  },

  getAttributesForElementType: function ( elementType ) {
    var discovered = this.discoveredAttributes || { nodes: {}, edges: {} };
    return elementType === 'edge' ? discovered.edges : discovered.nodes;
  },

  getSelectedAttributeMeta: function () {
    var attributeName = $( '#mappingAttribute' ).val();
    if ( !attributeName ) {
      return null;
    }

    var attributeMap = this.getAttributesForElementType( this.getSelectedElementType() );
    return attributeMap[ attributeName ] || null;
  },

  syncMappingTypeFromAttribute: function () {
    var meta = this.getSelectedAttributeMeta();
    if ( !meta ) {
      this.populateVisualPropertyDropdown();
      return;
    }

    var mappingType = meta.type === 'numerical' ? 'continuous' : 'discrete';
    $( '#mappingMappingType' ).val( mappingType );
    this.populateVisualPropertyDropdown();
  },

  isColorVisualProperty: function ( propertyId ) {
    return this.COLOR_VISUAL_PROPERTIES.indexOf( propertyId ) !== -1;
  },

  isSelectionComplete: function () {
    return !!(
      $( '#mappingAttribute' ).val() &&
      $( '#mappingVisualProperty' ).val()
    );
  },

  getDefaultColor: function ( index ) {
    return this.DEFAULT_COLORS[ index % this.DEFAULT_COLORS.length ];
  },

  clearMappingConfig: function () {
    $( '#mappingConfigContent .colorpicker-component' ).each( function () {
      var $picker = $( this );
      if ( $picker.data( 'colorpicker' ) ) {
        $picker.colorpicker( 'destroy' );
      }
    } );
    $( '#mappingConfigContent' ).empty();
    $( '#mappingConfigSection' ).hide();
  },

  renderConfigMessage: function ( message ) {
    $( '#mappingConfigContent' ).html(
      $( '<p>', { 'class': 'text-muted text-center', text: message } )
    );
    $( '#mappingConfigSection' ).show();
  },

  initConfigColorPickers: function () {
    $( '#mappingConfigContent .colorpicker-component' ).each( function () {
      $( this ).colorpicker();
    } );
  },

  renderDiscreteColorConfig: function ( meta ) {
    var self = this;
    var $container = $( '<div>' );

    _.each( meta.values, function ( value, index ) {
      var $row = $( '<div>', { 'class': 'form-group' } );
      $row.append( $( '<label>', {
        'class': 'col-sm-5 control-label',
        text: String( value )
      } ) );

      var $pickerWrap = $( '<div>', { 'class': 'col-sm-7' } );
      var $picker = $( '<div>', {
        'class': 'input-group colorpicker-component mapping-discrete-color'
      } );
      $picker.attr( 'data-category-value', value );
      $picker.append( $( '<input>', {
        type: 'text',
        'class': 'form-control',
        value: self.getDefaultColor( index )
      } ) );
      $picker.append( $( '<span>', { 'class': 'input-group-addon' } ).append( $( '<i>' ) ) );

      $pickerWrap.append( $picker );
      $row.append( $pickerWrap );
      $container.append( $row );
    } );

    $( '#mappingConfigContent' ).html( $container );
    this.initConfigColorPickers();
    $( '#mappingConfigSection' ).show();
  },

  renderContinuousColorConfig: function ( meta ) {
    var $container = $( '<div>' );

    $container.append( $( '<p>', {
      'class': 'text-center text-muted',
      text: 'Range: ' + meta.min + ' to ' + meta.max
    } ) );

    var lowRow = $( '<div>', { 'class': 'form-group' } );
    lowRow.append( $( '<label>', {
      'class': 'col-sm-5 control-label',
      text: 'Low (' + meta.min + ')'
    } ) );
    var $lowPicker = this._buildColorPicker( '#ffffcc' );
    $lowPicker.addClass( 'mapping-continuous-low' );
    lowRow.append( $( '<div>', { 'class': 'col-sm-7' } ).append( $lowPicker ) );
    $container.append( lowRow );

    var highRow = $( '<div>', { 'class': 'form-group' } );
    highRow.append( $( '<label>', {
      'class': 'col-sm-5 control-label',
      text: 'High (' + meta.max + ')'
    } ) );
    var $highPicker = this._buildColorPicker( '#cc0000' );
    $highPicker.addClass( 'mapping-continuous-high' );
    highRow.append( $( '<div>', { 'class': 'col-sm-7' } ).append( $highPicker ) );
    $container.append( highRow );

    $( '#mappingConfigContent' ).html( $container );
    this.initConfigColorPickers();
    $( '#mappingConfigSection' ).show();
  },

  _buildColorPicker: function ( defaultColor ) {
    var $picker = $( '<div>', { 'class': 'input-group colorpicker-component' } );
    $picker.append( $( '<input>', {
      type: 'text',
      'class': 'form-control',
      value: defaultColor
    } ) );
    $picker.append( $( '<span>', { 'class': 'input-group-addon' } ).append( $( '<i>' ) ) );
    return $picker;
  },

  updateMappingConfig: function () {
    this.clearMappingConfig();

    if ( !this.isSelectionComplete() ) {
      return;
    }

    var meta = this.getSelectedAttributeMeta();
    var visualProperty = $( '#mappingVisualProperty' ).val();
    var mappingType = this.getSelectedMappingType();

    if ( !meta ) {
      return;
    }

    if ( mappingType === 'discrete' && meta.type === 'categorical' ) {
      if ( this.isColorVisualProperty( visualProperty ) ) {
        this.renderDiscreteColorConfig( meta );
      } else {
        this.renderConfigMessage( 'Configuration for this visual property is coming soon.' );
      }
      return;
    }

    if ( mappingType === 'continuous' && meta.type === 'numerical' ) {
      if ( this.isColorVisualProperty( visualProperty ) ) {
        this.renderContinuousColorConfig( meta );
      } else {
        this.renderConfigMessage( 'Configuration for this visual property is coming soon.' );
      }
      return;
    }

    this.renderConfigMessage( 'This attribute and mapping type combination is not supported yet.' );
  },

  populateAttributeDropdown: function () {
    var elementType = this.getSelectedElementType();
    var attributeMap = this.getAttributesForElementType( elementType );
    var attributeNames = _.sortBy( _.keys( attributeMap ) );
    var $select = $( '#mappingAttribute' );

    $select.empty();
    $select.append( $( '<option>', {
      value: '',
      text: 'Select attribute...'
    } ) );

    if ( attributeNames.length === 0 ) {
      $select.empty();
      $select.append( $( '<option>', {
        value: '',
        text: 'No mappable attributes found'
      } ) );
      $select.prop( 'disabled', true );
      return;
    }

    $select.prop( 'disabled', false );
    _.each( attributeNames, function ( name ) {
      $select.append( $( '<option>', {
        value: name,
        text: name
      } ) );
    } );
  },

  populateVisualPropertyDropdown: function () {
    var properties = this.getVisualPropertiesForSelection();
    var $select = $( '#mappingVisualProperty' );

    $select.empty();
    $select.append( $( '<option>', {
      value: '',
      text: 'Select visual property...'
    } ) );

    if ( properties.length === 0 ) {
      $select.prop( 'disabled', true );
      return;
    }

    $select.prop( 'disabled', false );
    _.each( properties, function ( property ) {
      $select.append( $( '<option>', {
        value: property.id,
        text: property.label
      } ) );
    } );
  },

  openPanel: function () {
    this.init();
    this.clearMappingConfig();
    this.populateAttributeDropdown();
    this.populateVisualPropertyDropdown();

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
