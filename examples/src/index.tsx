import './style.scss';
import {Component, MouseEvent} from 'react';

import ReactDiff, {DiffMethod} from '../../src/index';
import logo from '../../logo.png';
import cn from 'classnames';
import {createRoot} from "react-dom/client";

import oldJs from './diff/javascript/old.rjs?raw';
import newJs from './diff/javascript/new.rjs?raw';

import oldYaml from './diff/massive/old.yaml?raw';
import newYaml from './diff/massive/new.yaml?raw';

import oldJson from './diff/json/old.json';
import newJson from './diff/json/new.json';

interface ExampleState {
  splitView?: boolean;
  highlightLine?: string[];
  language?: string;
  lineNumbers: boolean;
  theme: 'dark' | 'light';
  enableSyntaxHighlighting?: boolean;
  columnHeaders: boolean;
  compareMethod?: DiffMethod;
  dataType: string;
  customGutter?: boolean;
}

const P = (window as any).Prism;

class Example extends Component<{}, ExampleState> {
  public constructor(props: any) {
    super(props);
    this.state = {
      highlightLine: [],
      theme: 'dark',
      splitView: true,
      columnHeaders: true,
      lineNumbers: true,
      customGutter: true,
      enableSyntaxHighlighting: true,
      dataType: 'javascript',
      compareMethod: DiffMethod.CHARS
    };
  }

  private onLineNumberClick = (
    id: string,
    e: MouseEvent<HTMLTableCellElement>,
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
    let oldValue: string | object = ''
    let newValue: string | object = '';
    if (this.state.dataType === 'json') {
      oldValue = oldJson
      newValue = newJson
    } else if (this.state.dataType === 'javascript') {
      oldValue = oldJs
      newValue = newJs
    } else {
      oldValue = oldYaml
      newValue = newYaml
    }

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
          <p>
            This documentation is for the `next` release branch, e.g. v4.x
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
                  checked={this.state.columnHeaders}
                  onChange={() => {
                    this.setState({
                      columnHeaders:
                        !this.state.columnHeaders,
                    });
                  }}
                />
                <span className="slider round"></span>
              </label>
              <span>Column Headers</span>
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
            <div>
              <label className={'switch'}>
                <input
                  type="checkbox"
                  checked={this.state.lineNumbers}
                  onChange={() => {
                    this.setState({
                      lineNumbers: !this.state.lineNumbers,
                    });
                  }}
                />
                <span className="slider round"></span>
              </label>
              <span>Line Numbers</span>
            </div>
            <div>
              <label className={'select'}>
                <select
                  value={this.state.dataType}
                  onChange={(e) => {
                    this.setState({
                      dataType: e.currentTarget.value,
                      compareMethod: e.currentTarget.value === 'json' ? DiffMethod.JSON : DiffMethod.CHARS
                    });
                  }}
                >
                  <option>javascript</option>
                  <option>json</option>
                  <option>yaml</option>
                </select>
              </label>
              <span>Data</span>
            </div>
          </div>
        </div>
        <div className="diff-viewer">
          <ReactDiff
            highlightLines={this.state.highlightLine}
            onLineNumberClick={this.onLineNumberClick}
            alwaysShowLines={['L-30']}
            extraLinesSurroundingDiff={1}
            hideLineNumbers={!this.state.lineNumbers}
            oldValue={oldValue}
            compareMethod={this.state.compareMethod}
            splitView={this.state.splitView}
            newValue={newValue}
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
                          {diffData.type == 3
                            ? 'CHG'
                            : diffData.type == 2
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
            summary={this.state.compareMethod === DiffMethod.JSON ? 'package.json' : 'webpack.config.js'}
            leftTitle={this.state.columnHeaders ? `master@2178133 - pushed 2 hours ago.` : undefined}
            rightTitle={this.state.columnHeaders ? `master@64207ee - pushed 13 hours ago.` : undefined}
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

const root = createRoot(document.getElementById('app'));
root.render(<Example />);
