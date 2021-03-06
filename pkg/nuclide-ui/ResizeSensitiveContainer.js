/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import React from 'react';
import classnames from 'classnames';
import {nextAnimationFrame} from 'nuclide-commons/observable';

type SensorProps = {
  targetHeight: number,
  targetWidth: number,
  onDetectedResize: () => void,
};

const EXPANSION_BUFFER = 50;

/**
 * Hidden set of DOM nodes that are used to detect resizes through onScroll events.
 *
 * This component works by injecting two sets of divs, one for detecting expansions
 * and one for detecting shrinking. They are sized and have their scroll positions
 * set in a specific way so that a resize of the container will trigger an onScroll
 * event. This is used as the basis for the "onResize" event.
 *
 * The scroll position of the inner divs can be reset when DOM nodes are shuffled
 * around, which will break the resize detection. To handle this case, the sensor
 * uses a CSS animation and listens for onAnimationStart to know when to reset the
 * scroll positions.
 *
 * This strategy is derived from https://github.com/wnr/element-resize-detector
 */
class ResizeSensor extends React.Component {
  props: SensorProps;
  _expand: ?HTMLElement;
  _shrink: ?HTMLElement;

  componentDidMount(): void {
    this._resetScrollbars();
  }

  componentDidUpdate(prevProps: SensorProps): void {
    const {targetWidth, targetHeight} = this.props;
    if (
      prevProps.targetWidth !== targetWidth ||
      prevProps.targetHeight !== targetHeight
    ) {
      this._resetScrollbars();
    }
  }

  _resetScrollbars(): void {
    if (this._expand == null || this._shrink == null) {
      return;
    }

    this._expand.scrollLeft = this._expand.scrollWidth;
    this._expand.scrollTop = this._expand.scrollHeight;

    this._shrink.scrollLeft = this._shrink.scrollWidth;
    this._shrink.scrollTop = this._shrink.scrollHeight;
  }

  _handleScroll = (): void => {
    this._resetScrollbars();
    this.props.onDetectedResize();
  };

  _handleExpandRef = (el: HTMLElement): void => {
    this._expand = el;
  };

  _handleShrinkRef = (el: HTMLElement): void => {
    this._shrink = el;
  };

  render(): React.Element<any> {
    const {targetWidth, targetHeight} = this.props;
    const expandInnerStyle = {
      width: targetWidth + EXPANSION_BUFFER,
      height: targetHeight + EXPANSION_BUFFER,
    };

    return (
      <div
        className="nuclide-resize-sensitive-container-sensor"
        onAnimationStart={this._handleScroll}>
        <div
          ref={this._handleExpandRef}
          className="nuclide-resize-sensitive-container-expand"
          onScroll={this._handleScroll}>
          <div
            className="nuclide-resize-sensitive-container-expand-inner"
            style={expandInnerStyle}
          />
        </div>
        <div
          ref={this._handleShrinkRef}
          className="nuclide-resize-sensitive-container-shrink"
          onScroll={this._handleScroll}>
          <div className="nuclide-resize-sensitive-container-shrink-inner" />
        </div>
      </div>
    );
  }
}

type Props = {
  className?: string,
  tabIndex?: string,
  children?: React.Element<any>,
  onResize: (height: number, width: number) => void,
};

type State = {
  height: number,
  width: number,
};

/**
 * Size-sensitive container that provides an onResize callback that
 * is invoked with the container's width and height whenever it changes.
 *
 * NOTE: This component is meant to be used to detect size changes that
 *       are not a result of a DOM mutation. If you only care about size
 *       changes as a result of a DOM mutation, use MeasuredComponent
 *       instead.
 */
export class ResizeSensitiveContainer extends React.Component {
  props: Props;
  state: State;

  _container: ?HTMLElement;
  _rafDisposable: ?rxjs$Subscription;

  constructor(props: Props) {
    super(props);
    this.state = {
      height: -1,
      width: -1,
    };
  }

  componentWillUnmount(): void {
    if (this._rafDisposable != null) {
      this._rafDisposable.unsubscribe();
    }
  }

  _containerRendered(): boolean {
    return this.state.height !== -1 && this.state.width !== -1;
  }

  _handleContainer = (el: ?HTMLElement): void => {
    this._container = el;
    this._updateContainerSize();
  };

  _updateContainerSize = (): void => {
    if (this._container == null) {
      return;
    }

    const {offsetHeight, offsetWidth} = this._container;
    const {height, width} = this.state;
    if (offsetHeight === height && offsetWidth === width) {
      return;
    }

    this.setState({
      height: offsetHeight,
      width: offsetWidth,
    });
    this.props.onResize(offsetHeight, offsetWidth);
  };

  _handleResize = (): void => {
    if (this._rafDisposable != null) {
      this._rafDisposable.unsubscribe();
    }
    this._rafDisposable = nextAnimationFrame.subscribe(
      this._updateContainerSize,
    );
  };

  render(): React.Element<any> {
    const {children, className, tabIndex} = this.props;
    const {height, width} = this.state;
    const containerClasses = classnames(
      'nuclide-resize-sensitive-container',
      className,
    );
    return (
      <div className="nuclide-resize-sensitive-container-wrapper">
        <div
          ref={this._handleContainer}
          className={containerClasses}
          tabIndex={tabIndex}>
          {children}
        </div>
        {this._containerRendered()
          ? <ResizeSensor
              targetHeight={height}
              targetWidth={width}
              onDetectedResize={this._handleResize}
            />
          : null}
      </div>
    );
  }
}
