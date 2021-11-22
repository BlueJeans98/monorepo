/* istanbul ignore file */

import React from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { useSocket } from 'socket.io-react-hook';

import useScreenType from '../../hooks/useScreenType';
import loadingState from '../../recoil/loading';
import ScreenType from '../../types/screen';
import { conditionalClassName } from '../../utils/style';

import DebugWrapper from './DebugWrapper';

const Debug: React.FC = () => {
  const screenType = useScreenType();
  const setLoading = useSetRecoilState(loadingState.atom);

  const { connected } = useSocket(
    '/',
    process.env.NODE_ENV === 'production' || !process.env.REACT_APP_PROXY_URL
      ? undefined
      : {
        host: process.env.REACT_APP_PROXY_URL.replace(/https?:\/\//g, ''),
      },
  );

  React.useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      setLoading(!connected);
    }
  }, [connected]);

  return (
    <DebugWrapper>
      <span className="bold text-blue-500">
        {connected ? 'Connected!' : 'Disconnected.'}
      </span>
      <br />
      {/* Tailwind screen prefix에 대한 workaround (이슈 #49 참조) */}
      <span
        className={conditionalClassName({
          desktop: 'text-blue-500',
          mobileLandscape: 'text-green-500',
          mobilePortrait: 'text-red-500',
        })(screenType)}
      >
        Screen type:
        {' '}
        {ScreenType[screenType]}
      </span>
    </DebugWrapper>
  );
};

export default Debug;
