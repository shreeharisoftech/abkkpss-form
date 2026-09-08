import bcrypt from 'bcryptjs';
import { AcWebController, AcWebRoute, AcWebResponse, IAcWebRequestHandlerArgs } from 'ac-web';
import { DbService } from '../database/db-service';
import { generateToken, getUserFromRequest } from '../middlewares/auth.middleware';

@AcWebController()
@AcWebRoute({ path: '/api/auth' })
export class AuthController {
  @AcWebRoute({ path: '/login', method: 'post' })
  async login(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const body = request.post || {};
    const { username, password } = body;

    if (!username || !password) {
      return AcWebResponse.json({
        data: { success: false, error: 'Username and password are required' },
        responseCode: 400,
      });
    }

    const db = DbService.getInstance();
    const user = await db.getUserByUsername(username.trim());
    if (!user) {
      return AcWebResponse.json({
        data: { success: false, error: 'Invalid username or password' },
        responseCode: 401,
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return AcWebResponse.json({
        data: { success: false, error: 'Invalid username or password' },
        responseCode: 401,
      });
    }

    const token = generateToken({
      userId: user.id!,
      username: user.username,
      role: user.role,
      zoneId: user.zone_id,
    });

    const response = AcWebResponse.json({
      data: {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          zone_id: user.zone_id,
        },
      },
    });

    // Also set cookie for convenience
    response.cookies['token'] = token;
    return response;
  }

  @AcWebRoute({ path: '/me', method: 'get' })
  async me(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return AcWebResponse.json({
        data: { success: false, error: 'Unauthorized' },
        responseCode: 401,
      });
    }

    const db = DbService.getInstance();
    const user = await db.getUserById(userPayload.userId);
    if (!user) {
      return AcWebResponse.json({
        data: { success: false, error: 'User not found' },
        responseCode: 404,
      });
    }

    return AcWebResponse.json({
      data: {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          zone_id: user.zone_id,
        },
      },
    });
  }

  @AcWebRoute({ path: '/logout', method: 'post' })
  async logout(): Promise<AcWebResponse> {
    const response = AcWebResponse.json({
      data: { success: true, message: 'Logged out successfully' },
    });
    response.cookies['token'] = '';
    return response;
  }

  @AcWebRoute({ path: '/update-password', method: 'post' })
  @AcWebRoute({ path: '/change-password', method: 'post' })
  async updatePassword(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return AcWebResponse.json({
        data: { success: false, error: 'Unauthorized' },
        responseCode: 401,
      });
    }

    const body = request.post || {};
    const { currentPassword, newPassword, password } = body;
    const targetPassword = newPassword || password;

    if (!currentPassword) {
      return AcWebResponse.json({
        data: { success: false, error: 'Current password is required' },
        responseCode: 400,
      });
    }

    if (!targetPassword || typeof targetPassword !== 'string' || targetPassword.trim().length < 4) {
      return AcWebResponse.json({
        data: { success: false, error: 'New password must be at least 4 characters long' },
        responseCode: 400,
      });
    }

    const db = DbService.getInstance();
    const user = await db.getUserById(userPayload.userId);
    if (!user) {
      return AcWebResponse.json({
        data: { success: false, error: 'User not found' },
        responseCode: 404,
      });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return AcWebResponse.json({
        data: { success: false, error: 'Current password is incorrect' },
        responseCode: 400,
      });
    }

    const passwordHash = await bcrypt.hash(targetPassword.trim(), 10);
    const success = await db.updateUser(user.id!, { password_hash: passwordHash });

    return AcWebResponse.json({
      data: {
        success,
        message: success ? 'Password updated successfully' : 'Failed to update password',
      },
    });
  }
}
