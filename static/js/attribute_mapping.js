/**
 * Visual Attribute Mapping — attribute discovery from graph_json.
 */
var attributeMapping = {
  RESERVED_NODE_ATTRS: [ 'id', 'name', 'label', 'aliases', 'popup', 'k', 'parent' ],
  RESERVED_EDGE_ATTRS: [ 'id', 'source', 'target', 'name', 'is_directed', 'popup', 'k' ],

  discoveredAttributes: null,
  styleBeforeMapping: null,

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

    $( '#applyMappingBtn' ).off( 'click' ).on( 'click', function ( e ) {
      e.preventDefault();
      attributeMapping.applyMapping();
    } );

    $( '#resetMappingBtn' ).off( 'click' ).on( 'click', function ( e ) {
      e.preventDefault();
      attributeMapping.resetMapping();
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

  getColorPickerValue: function ( $picker ) {
    if ( $picker.data( 'colorpicker' ) ) {
      return $picker.colorpicker( 'getValue' );
    }
    return $picker.find( 'input' ).val();
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

  isContinuousColorMappingReady: function () {
    if ( !this.isSelectionComplete() ) {
      return false;
    }

    var meta = this.getSelectedAttributeMeta();
    var visualProperty = $( '#mappingVisualProperty' ).val();

    return !!(
      meta &&
      meta.type === 'numerical' &&
      this.getSelectedMappingType() === 'continuous' &&
      this.isColorVisualProperty( visualProperty ) &&
      $( '#mappingConfigContent .mapping-continuous-low' ).length > 0 &&
      $( '#mappingConfigContent .mapping-continuous-high' ).length > 0
    );
  },

  getContinuousColorMappingFromUI: function () {
    if ( !this.isContinuousColorMappingReady() ) {
      return null;
    }

    var meta = this.getSelectedAttributeMeta();
    var lowColor = this.getColorPickerValue( $( '#mappingConfigContent .mapping-continuous-low' ) );
    var highColor = this.getColorPickerValue( $( '#mappingConfigContent .mapping-continuous-high' ) );

    if ( !lowColor || !highColor ) {
      return null;
    }

    return {
      elementType: this.getSelectedElementType(),
      attribute: $( '#mappingAttribute' ).val(),
      visualProperty: $( '#mappingVisualProperty' ).val(),
      mappingType: 'continuous',
      min: meta.min,
      max: meta.max,
      lowColor: lowColor,
      highColor: highColor
    };
  },

  isDiscreteColorMappingReady: function () {
    if ( !this.isSelectionComplete() ) {
      return false;
    }

    var meta = this.getSelectedAttributeMeta();
    var visualProperty = $( '#mappingVisualProperty' ).val();

    return !!(
      meta &&
      meta.type === 'categorical' &&
      this.getSelectedMappingType() === 'discrete' &&
      this.isColorVisualProperty( visualProperty ) &&
      $( '#mappingConfigContent .mapping-discrete-color' ).length > 0
    );
  },

  getDiscreteColorMappingFromUI: function () {
    if ( !this.isDiscreteColorMappingReady() ) {
      return null;
    }

    var valueColors = {};
    var self = this;
    var hasEmptyColor = false;

    $( '#mappingConfigContent .mapping-discrete-color' ).each( function () {
      var $picker = $( this );
      var categoryValue = $picker.attr( 'data-category-value' );
      var color = self.getColorPickerValue( $picker );

      if ( !color ) {
        hasEmptyColor = true;
        return false;
      }

      valueColors[ categoryValue ] = color;
    } );

    if ( hasEmptyColor || _.isEmpty( valueColors ) ) {
      return null;
    }

    return {
      elementType: this.getSelectedElementType(),
      attribute: $( '#mappingAttribute' ).val(),
      visualProperty: $( '#mappingVisualProperty' ).val(),
      mappingType: 'discrete',
      valueColors: valueColors
    };
  },

  getMappingFromUI: function () {
    return this.getDiscreteColorMappingFromUI() ||
      this.getContinuousColorMappingFromUI();
  },

  _formatSelectorAttributeValue: function ( value ) {
    return '"' + String( value ).replace( /\\/g, '\\\\' ).replace( /"/g, '\\"' ) + '"';
  },

  _buildAttributeSelector: function ( elementType, attribute, value ) {
    var elementSelector = elementType === 'edge' ? 'edge' : 'node';
    return elementSelector + '[' + attribute + ' = ' + this._formatSelectorAttributeValue( value ) + ']';
  },

  _buildDiscreteColorStyle: function ( visualProperty, color ) {
    if ( visualProperty === 'background-color' ) {
      return {
        'background-color': color,
        'text-outline-color': color
      };
    }

    if ( visualProperty === 'line-color' ) {
      return {
        'line-color': color,
        'target-arrow-color': color,
        'source-arrow-color': color
      };
    }

    var style = {};
    style[ visualProperty ] = color;
    return style;
  },

  buildDiscreteColorStyleRules: function ( mapping ) {
    if ( !mapping || mapping.mappingType !== 'discrete' || !mapping.valueColors ) {
      return [];
    }

    var self = this;
    var elementType = mapping.elementType === 'edge' ? 'edge' : 'node';

    return _.map( mapping.valueColors, function ( color, categoryValue ) {
      return {
        selector: self._buildAttributeSelector( elementType, mapping.attribute, categoryValue ),
        style: self._buildDiscreteColorStyle( mapping.visualProperty, color )
      };
    } );
  },

  _buildMapDataValue: function ( attribute, min, max, minMapper, maxMapper ) {
    var mapMax = min === max ? max + 1 : max;
    return 'mapData(' + attribute + ', ' + min + ', ' + mapMax + ', ' + minMapper + ', ' + maxMapper + ')';
  },

  _buildContinuousColorStyle: function ( visualProperty, mapDataValue ) {
    if ( visualProperty === 'background-color' ) {
      return {
        'background-color': mapDataValue,
        'text-outline-color': mapDataValue
      };
    }

    if ( visualProperty === 'line-color' ) {
      return {
        'line-color': mapDataValue,
        'target-arrow-color': mapDataValue,
        'source-arrow-color': mapDataValue
      };
    }

    var style = {};
    style[ visualProperty ] = mapDataValue;
    return style;
  },

  buildContinuousColorStyleRules: function ( mapping ) {
    if ( !mapping || mapping.mappingType !== 'continuous' ) {
      return [];
    }

    var elementType = mapping.elementType === 'edge' ? 'edge' : 'node';
    var selector = elementType + '[' + mapping.attribute + ']';
    var mapDataValue = this._buildMapDataValue(
      mapping.attribute,
      mapping.min,
      mapping.max,
      mapping.lowColor,
      mapping.highColor
    );

    return [ {
      selector: selector,
      style: this._buildContinuousColorStyle( mapping.visualProperty, mapDataValue )
    } ];
  },

  buildStyleRules: function ( mapping ) {
    if ( !mapping ) {
      return [];
    }

    if ( mapping.mappingType === 'discrete' ) {
      return this.buildDiscreteColorStyleRules( mapping );
    }

    if ( mapping.mappingType === 'continuous' ) {
      return this.buildContinuousColorStyleRules( mapping );
    }

    return [];
  },

  _applyStyleRules: function ( rules ) {
    if ( _.isEmpty( rules ) ) {
      return false;
    }

    if ( typeof graphPage === 'undefined' || !graphPage.cyGraph ) {
      return false;
    }

    var cy = graphPage.cyGraph;

    if ( !this.styleBeforeMapping ) {
      this.styleBeforeMapping = cytoscapeGraph.getStylesheet( cy );
    }

    var tempStyle = cy.style();

    _.each( rules, function ( rule ) {
      tempStyle = tempStyle.selector( rule.selector ).style( rule.style );
    } );

    _.each( selectedElementsStylesheet, function ( elemStyle ) {
      tempStyle = tempStyle.selector( elemStyle.selector ).style( elemStyle.style );
    } );

    tempStyle.update();

    if ( graphPage.layoutEditor && graphPage.layoutEditor.undoRedoManager ) {
      graphPage.layoutEditor.undoRedoManager.update( {
        'action_type': 'attribute_mapping',
        'data': {
          'style': cytoscapeGraph.getStylesheet( cy ),
          'positions': cytoscapeGraph.getRenderedNodePositionsMap( cy ),
          'selected_elements': cy.elements( ':selected' ),
          'metadata': layoutLearner.computeLayoutMetadata( cy )
        }
      } );
    }

    return true;
  },

  applyMapping: function () {
    var mapping = this.getMappingFromUI();
    if ( !mapping ) {
      $.notify( {
        message: 'Complete the mapping configuration before applying.'
      }, {
        type: 'warning'
      } );
      return false;
    }

    var rules = this.buildStyleRules( mapping );
    if ( !this._applyStyleRules( rules ) ) {
      return false;
    }

    $.notify( {
      message: 'Attribute mapping applied.'
    }, {
      type: 'success'
    } );

    return true;
  },

  resetMapping: function () {
    if ( !this.styleBeforeMapping ) {
      $.notify( {
        message: 'No mapping to reset.'
      }, {
        type: 'warning'
      } );
      return false;
    }

    if ( typeof graphPage === 'undefined' || !graphPage.cyGraph ) {
      return false;
    }

    var cy = graphPage.cyGraph;

    cytoscapeGraph.applyStylesheet( cy, {
      style: this.styleBeforeMapping
    } );
    this.styleBeforeMapping = null;

    if ( graphPage.layoutEditor && graphPage.layoutEditor.undoRedoManager ) {
      graphPage.layoutEditor.undoRedoManager.update( {
        'action_type': 'attribute_mapping_reset',
        'data': {
          'style': cytoscapeGraph.getStylesheet( cy ),
          'positions': cytoscapeGraph.getRenderedNodePositionsMap( cy ),
          'selected_elements': cy.elements( ':selected' ),
          'metadata': layoutLearner.computeLayoutMetadata( cy )
        }
      } );
    }

    $.notify( {
      message: 'Attribute mapping reset.'
    }, {
      type: 'success'
    } );

    return true;
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
    this.styleBeforeMapping = null;
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
