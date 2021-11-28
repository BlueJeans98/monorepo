import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import GitHubStrategy from 'passport-github';

import PassportOauth2 from 'passport-oauth2';
import { Connection } from 'typeorm';

import SSOAccountEntity from './entity/sso-account';
import UserEntity from './entity/user';

import server from '.';

import { Strategy as NaverStrategy, Profile as NaverProfile } from 'passport-naver-v2';

export default (connection: Connection) => {
  const userRepository = connection.getRepository(UserEntity);
  const ssoAccountRepository = connection.getRepository(SSOAccountEntity);

  passport.serializeUser(
    (req: Request, user: Express.User, done: (err: any, id: number) => void) => {
      done(null, user.id);
    },
  );

  passport.deserializeUser((id: string, done) => {
    userRepository.findOne(id).then((user) => {
      if (!user) {
        done(new Error(`User ${id} not found.`), null);
      } else {
        done(null, user);
      }
    });
  });

  const naverCallbackURL = process.env.AUTH_NAVER_CALLBACK_URL!.replace(':80', '');
  const githubCallbackURL = process.env.AUTH_GITHUB_CALLBACK_URL!.replace(':80', '');

  /** Sign in with Naver. */
  passport.use(new NaverStrategy({
    callbackURL: naverCallbackURL,
    clientID: process.env.AUTH_NAVER_CLIENT_ID,
    clientSecret: process.env.AUTH_NAVER_CLIENT_SECRET,
    passReqToCallback: true,
  }, async (
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: NaverProfile,
    done: PassportOauth2.VerifyCallback,
  ) => {
    const providerId = profile.email?.replace(/@.*$/, '') ?? profile.id;

    try {
      const ssoAccount = await ssoAccountRepository.findOne({
        where: { provider: profile.provider, providerId },
        join: {
          alias: 'ssoAccount',
          leftJoinAndSelect: {
            user: 'ssoAccount.user',
          },
        },
      });

      let user: UserEntity;
      if (ssoAccount) {
        if (!req.user || req.user.id === ssoAccount.user.id) {
          user = ssoAccount.user;
        } else {
          // 다른 user와 연결되어 있는 SSO Account로 로그인 했을 때
          const toast = '이미 다른 계정에 연결되어 있는 소셜 계정과 연결할 수 없습니다. 소셜 계정과 연결된 계정을 탈퇴한 후 다시 시도해 주세요.';
          req.session.toast = toast;
          user = req.user as UserEntity;
        }
      } else {
        if (!req.user) {
          user = new UserEntity();
          user.stringId = `${profile.provider}:${providerId}`;
          user.displayName = profile.name ?? profile.nickname!;
          user.profileImage = profile.profileImage ?? null!;
          user.initialized = false;
          await user.save();
          await server.managers.user.refreshUserInfo(user.stringId);
        } else {
          user = req.user as UserEntity;
        }

        const newSSOAccount = new SSOAccountEntity();
        newSSOAccount.provider = profile.provider;
        newSSOAccount.providerId = providerId;
        newSSOAccount.user = user;
        await newSSOAccount.save();
        await server.managers.user.refreshUserInfo(user.stringId);
      }
      return done(null, user);
    } catch (error: any) {
      console.error(error);
      done(error, undefined);
    }
  }));

  /** Sign in with GitHub. */
  passport.use(new GitHubStrategy({
    callbackURL: githubCallbackURL,
    clientID: process.env.AUTH_GITHUB_CLIENT_ID!,
    clientSecret: process.env.AUTH_GITHUB_CLIENT_SECRET!,
    passReqToCallback: true,
  },
  async (req, accessToken, refreshToken, profile, done) => {
    const providerId = profile.username ?? profile.id;

    try {
      const ssoAccount = await ssoAccountRepository.findOne({
        where: { provider: profile.provider, providerId },
        join: {
          alias: 'ssoAccount',
          leftJoinAndSelect: {
            user: 'ssoAccount.user',
          },
        },
      });

      let user: UserEntity;
      const placeholderProfileImage = 'https://ssl.pstatic.net/static/pwe/address/img_profile.png';
      if (ssoAccount) {
        if (!req.user || req.user.id === ssoAccount.user.id) {
          user = ssoAccount.user;
        } else {
          // 다른 user와 연결되어 있는 SSO Account로 로그인 했을 때
          const toast = '이미 다른 계정에 연결되어 있는 소셜 계정과 연결할 수 없습니다. 소셜 계정과 연결된 계정을 탈퇴한 후 다시 시도해 주세요.';
          req.session.toast = toast;
          user = req.user as UserEntity;
        }
      } else {
        if (!req.user) {
          user = new UserEntity();
          user.stringId = `${profile.provider}:${providerId}`;
          user.displayName = profile.displayName;
          user.profileImage = profile.photos?.[0]?.value ?? placeholderProfileImage;
          user.initialized = false;
          await user.save();
          await server.managers.user.refreshUserInfo(user.stringId);
        } else {
          user = req.user as UserEntity;
        }

        const newSSOAccount = new SSOAccountEntity();
        newSSOAccount.provider = profile.provider;
        newSSOAccount.providerId = providerId;
        newSSOAccount.user = user;
        await newSSOAccount.save();
        await server.managers.user.refreshUserInfo(user.stringId);
      }
      return done(null, user);
    } catch (error: any) {
      console.error(error);
      done(error, undefined);
    }
  }));
};

/** Login Required middleware. */
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.session.redirectUri = req.path;
  return res.redirect('/login');
};

export const isAuthenticatedOrFail = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.sendStatus(401);
};
