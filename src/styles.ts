import { CSSInterpolation } from '@emotion/css';
import createEmotion from '@emotion/css/create-instance';

export interface ReactDiffViewerStyles {
  diffContainer?: string;
  diffRemoved?: string;
  diffAdded?: string;
  diffChanged?: string;
  line?: string;
  highlightedGutter?: string;
  contentText?: string;
  lineContent?: string;
  gutter?: string;
  highlightedLine?: string;
  lineNumber?: string;
  marker?: string;
  wordDiff?: string;
  wordAdded?: string;
  wordRemoved?: string;
  codeFoldGutter?: string;
  summary?: string;
  codeFoldContentContainer?: string;
  emptyGutter?: string;
  emptyLine?: string;
  codeFold?: string;
  titleBlock?: string;
  content?: string;
  column?: string;
  noSelect?: string;
  splitView?: string;
  [key: string]: string | undefined;
}

export interface ReactDiffViewerStylesVariables {
  diffViewerBackground?: string;
  diffViewerTitleBackground?: string;
  diffViewerColor?: string;
  diffViewerTitleColor?: string;
  diffViewerTitleBorderColor?: string;
  addedBackground?: string;
  addedColor?: string;
  removedBackground?: string;
  removedColor?: string;
  changedBackground?: string;
  wordAddedBackground?: string;
  wordRemovedBackground?: string;
  addedGutterBackground?: string;
  removedGutterBackground?: string;
  gutterBackground?: string;
  gutterBackgroundDark?: string;
  highlightBackground?: string;
  highlightGutterBackground?: string;
  codeFoldGutterBackground?: string;
  codeFoldBackground?: string;
  emptyLineBackground?: string;
  gutterColor?: string;
  addedGutterColor?: string;
  removedGutterColor?: string;
  codeFoldContentColor?: string;
}

export interface ReactDiffViewerStylesOverride {
  variables?: {
    dark?: ReactDiffViewerStylesVariables;
    light?: ReactDiffViewerStylesVariables;
  };
  diffContainer?: CSSInterpolation;
  diffRemoved?: CSSInterpolation;
  diffAdded?: CSSInterpolation;
  diffChanged?: CSSInterpolation;
  marker?: CSSInterpolation;
  emptyGutter?: CSSInterpolation;
  highlightedLine?: CSSInterpolation;
  lineNumber?: CSSInterpolation;
  highlightedGutter?: CSSInterpolation;
  contentText?: CSSInterpolation;
  gutter?: CSSInterpolation;
  line?: CSSInterpolation;
  wordDiff?: CSSInterpolation;
  wordAdded?: CSSInterpolation;
  wordRemoved?: CSSInterpolation;
  codeFoldGutter?: CSSInterpolation;
  codeFoldContentContainer?: CSSInterpolation;
  codeFold?: CSSInterpolation;
  emptyLine?: CSSInterpolation;
  content?: CSSInterpolation;
  noSelect?: CSSInterpolation;
  column?: CSSInterpolation;
  titleBlock?: CSSInterpolation;
  splitView?: CSSInterpolation;
}

// eslint-disable-next-line import/no-anonymous-default-export
export default (
  styleOverride: ReactDiffViewerStylesOverride,
  useDarkTheme = false,
  nonce = '',
): ReactDiffViewerStyles => {
  const { variables: overrideVariables = {}, ...styles } = styleOverride;

  const themeVariables = {
    light: {
      ...{
        diffViewerBackground: '#fff',
        diffViewerColor: '#212529',
        addedBackground: '#e6ffed',
        addedColor: '#24292e',
        removedBackground: '#ffeef0',
        removedColor: '#24292e',
        changedBackground: '#fffbdd',
        wordAddedBackground: '#acf2bd',
        wordRemovedBackground: '#fdb8c0',
        addedGutterBackground: '#cdffd8',
        removedGutterBackground: '#ffdce0',
        gutterBackground: '#f7f7f7',
        gutterBackgroundDark: '#f3f1f1',
        highlightBackground: '#fffbdd',
        highlightGutterBackground: '#fff5b1',
        codeFoldGutterBackground: '#dbedff',
        codeFoldBackground: '#f1f8ff',
        emptyLineBackground: '#fafbfc',
        gutterColor: '#212529',
        addedGutterColor: '#212529',
        removedGutterColor: '#212529',
        codeFoldContentColor: '#212529',
        diffViewerTitleBackground: '#fafbfc',
        diffViewerTitleColor: '#212529',
        diffViewerTitleBorderColor: '#eee',
      },
      ...(overrideVariables.light || {}),
    },
    dark: {
      ...{
        diffViewerBackground: '#2e303c',
        diffViewerColor: '#FFF',
        addedBackground: '#044B53',
        addedColor: 'white',
        removedBackground: '#632F34',
        removedColor: 'white',
        changedBackground: '#3e302c',
        wordAddedBackground: '#055d67',
        wordRemovedBackground: '#7d383f',
        addedGutterBackground: '#034148',
        removedGutterBackground: '#632b30',
        gutterBackground: '#2c2f3a',
        gutterBackgroundDark: '#262933',
        highlightBackground: '#2a3967',
        highlightGutterBackground: '#2d4077',
        codeFoldGutterBackground: '#262831',
        codeFoldBackground: '#262831',
        emptyLineBackground: '#363946',
        gutterColor: '#666c87',
        addedGutterColor: '#8c8c8c',
        removedGutterColor: '#8c8c8c',
        codeFoldContentColor: '#656a8b',
        diffViewerTitleBackground: '#2f323e',
        diffViewerTitleColor: '#757a9b',
        diffViewerTitleBorderColor: '#353846',
      },
      ...(overrideVariables.dark || {}),
    },
  };

  const variables = useDarkTheme ? themeVariables.dark : themeVariables.light;

  const { css, cx } = createEmotion({ key: 'react-diff', nonce });

  const content = css({
    width: 'auto',
    label: 'content',
  });

  const splitView = css({
    label: 'split-view',
  });

  const summary = css({
    background: variables.diffViewerTitleBackground,
    color: variables.diffViewerTitleColor,
    padding: '0.5em 1em',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5em',
    fontFamily: "monospace",
    fill: variables.diffViewerTitleColor,
  })

  const diffContainer = css({
    width: '100%',
    minWidth: '1000px',
    overflowX: 'auto',
    tableLayout: 'fixed',
    background: variables.diffViewerBackground,
    pre: {
      margin: 0,
      whiteSpace: 'pre-wrap',
      lineHeight: '1.6em',
      width: 'fit-content'
    },
    label: 'diff-container',
    borderCollapse: 'collapse',
  });

  const lineContent = css({
    overflow: 'hidden',
    width: '100%'
  })

  const contentText = css({
    color: variables.diffViewerColor,
    whiteSpace: 'pre-wrap',
    fontFamily: 'monospace',
    textDecoration: 'none',
    label: 'content-text',
  });

  const unselectable = css({
    userSelect: 'none',
    label: 'unselectable',
  });

  const titleBlock = css({
    background: variables.diffViewerTitleBackground,
    padding: '0.5em',
    lineHeight: '1.4em',
    height: "2.4em",
    overflow: 'hidden',
    width: '50%',
    borderBottom: `1px solid ${variables.diffViewerTitleBorderColor}`,
    label: 'title-block',
    ':last-child': {
      borderLeft: `1px solid ${variables.diffViewerTitleBorderColor}`,
    },
    [`.${contentText}`]: {
      color: variables.diffViewerTitleColor,
    },
  });

  const lineNumber = css({
    color: variables.gutterColor,
    label: 'line-number',
  });

  const diffRemoved = css({
    background: variables.removedBackground,
    color: variables.removedColor,
    pre: {
      color: variables.removedColor,
    },
    [`.${lineNumber}`]: {
      color: variables.removedGutterColor,
    },
    label: 'diff-removed',
  });

  const diffAdded = css({
    background: variables.addedBackground,
    color: variables.addedColor,
    pre: {
      color: variables.addedColor,
    },
    [`.${lineNumber}`]: {
      color: variables.addedGutterColor,
    },
    label: 'diff-added',
  });

  const diffChanged = css({
    background: variables.changedBackground,
    [`.${lineNumber}`]: {
      color: variables.gutterColor,
    },
    label: 'diff-changed',
  });

  const wordDiff = css({
    padding: 2,
    display: 'inline-flex',
    borderRadius: 4,
    wordBreak: 'break-all',
    label: 'word-diff',
  });

  const wordAdded = css({
    background: variables.wordAddedBackground,
    textDecoration: 'none',
    label: 'word-added',
  });

  const wordRemoved = css({
    background: variables.wordRemovedBackground,
    textDecoration: 'none',
    label: 'word-removed',
  });

  const codeFoldGutter = css({
    backgroundColor: variables.codeFoldGutterBackground,
    label: 'code-fold-gutter',
    minWidth: '50px',
    width: '50px'
  });

  const codeFoldContentContainer = css({
    padding: '8px 16px'
  });

  const codeFoldContent = css({
    color: variables.codeFoldContentColor,
    label: 'code-fold-content',
  });

  const block = css({
    display: 'block',
    width: '10px',
    height: '10px',
    backgroundColor: '#ddd',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: variables.diffViewerTitleBorderColor
  });

  const blockAddition = css({
    backgroundColor: variables.wordAddedBackground
  })

  const blockDeletion = css({
    backgroundColor: variables.wordRemovedBackground
  })

  const codeFold = css({
    backgroundColor: variables.codeFoldBackground,
    height: 40,
    fontSize: 14,
    alignItems: 'center',
    userSelect: 'none',
    fontWeight: 700,
    label: 'code-fold',
    a: {
      textDecoration: 'underline !important',
      cursor: 'pointer',
      pre: {
        display: 'inline',
      },
    },
  });

  const emptyLine = css({
    backgroundColor: variables.emptyLineBackground,
    label: 'empty-line',
  });

  const marker = css({
    width: 28,
    paddingLeft: 10,
    paddingRight: 10,
    userSelect: 'none',
    label: 'marker',
    [`&.${diffAdded}`]: {
      pre: {
        color: variables.addedColor,
      },
    },
    [`&.${diffRemoved}`]: {
      pre: {
        color: variables.removedColor,
      },
    },
  });

  const highlightedLine = css({
    background: variables.highlightBackground,
    label: 'highlighted-line',
    [`.${wordAdded}, .${wordRemoved}`]: {
      backgroundColor: 'initial',
    },
  });

  const highlightedGutter = css({
    label: 'highlighted-gutter',
  });

  const gutter = css({
    userSelect: 'none',
    minWidth: 50,
    width: '50px',
    padding: '0 10px',
    whiteSpace: 'nowrap',
    label: 'gutter',
    textAlign: 'right',
    background: variables.gutterBackground,
    '&:hover': {
      cursor: 'pointer',
      background: variables.gutterBackgroundDark,
      pre: {
        opacity: 1,
      },
    },
    pre: {
      opacity: 0.5,
    },
    [`&.${diffAdded}`]: {
      background: variables.addedGutterBackground,
    },
    [`&.${diffRemoved}`]: {
      background: variables.removedGutterBackground,
    },
    [`&.${highlightedGutter}`]: {
      background: variables.highlightGutterBackground,
      '&:hover': {
        background: variables.highlightGutterBackground,
      },
    },
  });

  const emptyGutter = css({
    '&:hover': {
      background: variables.gutterBackground,
      cursor: 'initial',
    },
    label: 'empty-gutter',
  });

  const line = css({
    verticalAlign: 'baseline',
    label: 'line',
    textDecoration: 'none'
  });

  const column = css({

  })

  const defaultStyles: any = {
    diffContainer,
    diffRemoved,
    diffAdded,
    diffChanged,
    splitView,
    marker,
    highlightedGutter,
    highlightedLine,
    gutter,
    line,
    lineContent,
    wordDiff,
    wordAdded,
    summary,
    block,
    blockAddition,
    blockDeletion,
    wordRemoved,
    noSelect: unselectable,
    codeFoldGutter,
    codeFoldContentContainer,
    codeFold,
    emptyGutter,
    emptyLine,
    lineNumber,
    contentText,
    content,
    column,
    codeFoldContent,
    titleBlock,
  };

  const computerOverrideStyles: ReactDiffViewerStyles = Object.keys(
    styles,
  ).reduce(
    (acc, key): ReactDiffViewerStyles => ({
      ...acc,
      ...{
        [key]: css((styles as any)[key]),
      },
    }),
    {},
  );

  return Object.keys(defaultStyles).reduce(
    (acc, key): ReactDiffViewerStyles => ({
      ...acc,
      ...{
        [key]: computerOverrideStyles[key]
          ? cx(defaultStyles[key], computerOverrideStyles[key])
          : defaultStyles[key],
      },
    }),
    {},
  );
};
