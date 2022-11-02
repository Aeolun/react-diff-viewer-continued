import './style.scss';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import ReactDiff, { DiffMethod } from '../../src/index';

const oldJs = require('./diff/javascript/old.rjs').default;
const newJs = require('./diff/javascript/new.rjs').default;

const oldJson = require('./diff/json/old.json');
const newJson = require('./diff/json/new.json');

import logo from '../../logo.png';
import cn from 'classnames';

interface ExampleState {
  splitView?: boolean;
  highlightLine?: string[];
  language?: string;
  theme: 'dark' | 'light';
  enableSyntaxHighlighting?: boolean;
  compareMethod?: DiffMethod;
  customGutter?: boolean;
}

const P = (window as any).Prism;

class Example extends React.Component<{}, ExampleState> {
  public constructor(props: any) {
    super(props);
    this.state = {
      highlightLine: [],
      theme: 'dark',
      splitView: true,
      customGutter: true,
      enableSyntaxHighlighting: true,
    };
  }

  private onLineNumberClick = (
    id: string,
    e: React.MouseEvent<HTMLTableCellElement>,
  ): void => {
    let highlightLine = [id];
    if (e.shiftKey && this.state.highlightLine.length === 1) {
      const [dir, oldId] = this.state.highlightLine[0].split('-');
      const [newDir, newId] = id.split('-');
      if (dir === newDir) {
        highlightLine = [];
        const lowEnd = Math.min(Number(oldId), Number(newId));
        const highEnd = Math.max(Number(oldId), Number(newId));
        for (let i = lowEnd; i <= highEnd; i++) {
          highlightLine.push(`${dir}-${i}`);
        }
      }
    }
    this.setState({
      highlightLine,
    });
  };

  private syntaxHighlight = (str: string): any => {
    if (!str) return;
    const language = P.highlight(str, P.languages.javascript);
    return <span dangerouslySetInnerHTML={{ __html: language }} />;
  };

  public render(): JSX.Element {
    return (
      <div className="react-diff-viewer-example">
        <div className="radial"></div>
        <div className="banner">
          <div className="img-container">
            <img src={logo} alt="React Diff Viewer Logo" />
          </div>
          <p>
            A simple and beautiful text diff viewer made with{' '}
            <a href="https://github.com/kpdecker/jsdiff" target="_blank">
              Diff{' '}
            </a>
            and{' '}
            <a href="https://reactjs.org" target="_blank">
              React.{' '}
            </a>
            Featuring split view, inline view, word diff, line highlight and
            more.
          </p>
          <div className="cta">
            <a href="https://github.com/aeolun/react-diff-viewer-continued#install">
              <button type="button" className="btn btn-primary btn-lg">
                Documentation
              </button>
            </a>
          </div>

          <div className="options">
            <div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={this.state.theme === 'dark'}
                  onChange={() => {
                    if (this.state.theme === 'dark') {
                      document.body.classList.add('light');
                    } else {
                      document.body.classList.remove('light');
                    }
                    this.setState({
                      theme: this.state.theme === 'dark' ? 'light' : 'dark',
                    });
                  }}
                />
                <span className="slider round"></span>
              </label>
              <span>Dark theme</span>
            </div>
            <div>
              <label className={'switch'}>
                <input
                  type="checkbox"
                  checked={this.state.splitView}
                  onChange={() => {
                    this.setState({
                      splitView: !this.state.splitView,
                    });
                  }}
                />
                <span className="slider round"></span>
              </label>
              <span>Split pane</span>
            </div>
            <div>
              <label className={'switch'}>
                <input
                  type="checkbox"
                  checked={this.state.enableSyntaxHighlighting}
                  onChange={() => {
                    this.setState({
                      enableSyntaxHighlighting:
                        !this.state.enableSyntaxHighlighting,
                    });
                  }}
                />
                <span className="slider round"></span>
              </label>
              <span>Syntax highlighting</span>
            </div>
            <div>
              <label className={'switch'}>
                <input
                  type="checkbox"
                  checked={this.state.customGutter}
                  onChange={() => {
                    this.setState({
                      customGutter: !this.state.customGutter,
                    });
                  }}
                />
                <span className="slider round"></span>
              </label>
              <span>Custom gutter</span>
            </div>
          </div>
        </div>
        <div className="diff-viewer">
          <ReactDiff
            highlightLines={this.state.highlightLine}
            onLineNumberClick={this.onLineNumberClick}
            oldValue={oldJs}
            splitView={this.state.splitView}
            newValue={newJs}
            renderGutter={
              this.state.customGutter
                ? (diffData) => {
                    return (
                      <td
                        className={
                          diffData.type !== undefined
                            ? cn(diffData.styles.gutter)
                            : cn(
                                diffData.styles.gutter,
                                diffData.styles.emptyGutter,
                                {},
                              )
                        }
                        title={'extra info'}
                      >
                        <pre className={cn(diffData.styles.lineNumber, {})}>
                          {diffData.type == 2
                            ? 'DEL'
                            : diffData.type == 1
                            ? 'ADD'
                            : diffData.type
                            ? '==='
                            : undefined}
                        </pre>
                      </td>
                    );
                  }
                : undefined
            }
            renderContent={
              this.state.enableSyntaxHighlighting
                ? this.syntaxHighlight
                : undefined
            }
            useDarkTheme={this.state.theme === 'dark'}
            leftTitle="webpack.config.js master@2178133 - pushed 2 hours ago."
            rightTitle="webpack.config.js master@64207ee - pushed 13 hours ago."
          />
        </div>
        <footer>
          Originally made with 💓 by{' '}
          <a href="https://praneshravi.in" target="_blank">
            Pranesh Ravi
          </a>{' '}
          and extended by{' '}
          <a href="https://serial-experiments.com" target="_blank">
            Bart Riepe
          </a>
        </footer>
      </div>
    );
  }
}

ReactDOM.render(<Example />, document.getElementById('app'));
