import bcrypt from 'bcryptjs';
import { AcWebController, AcWebRoute, AcWebResponse, IAcWebRequestHandlerArgs } from 'ac-web';
import { DbService } from '../database/db-service';
import { UserRole } from '../database/schema';
import { requireAuth } from '../middlewares/auth.middleware';

@AcWebController()
@AcWebRoute({ path: '/api/users' })
export class UsersController {
  @AcWebRoute({ path: '', method: 'get' })
  async listUsers(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request, [UserRole.SUPER_ADMIN]);
    if ('responseCode' in authResult) return authResult as AcWebResponse;

    const db = DbService.getInstance();
    const users = await db.getAllUsers();

    return AcWebResponse.json({
      data: {
        success: true,
        count: users.length,
        users,
      },
    });
  }

  @AcWebRoute({ path: '', method: 'post' })
  async createUser(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request, [UserRole.SUPER_ADMIN]);
    if ('responseCode' in authResult) return authResult as AcWebResponse;

    const body = request.post || {};
    const { username, password, role = UserRole.REGULAR_USER, zone_id = null } = body;

    if (!username || !password) {
      return AcWebResponse.json({
        data: { success: false, error: 'Username and password are required' },
        responseCode: 400,
      });
    }

    const db = DbService.getInstance();
    const existing = await db.getUserByUsername(username.trim());
    if (existing) {
      return AcWebResponse.json({
        data: { success: false, error: 'Username already exists' },
        responseCode: 409,
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = await db.createUser({
      username: username.trim(),
      password_hash: passwordHash,
      role: role as UserRole,
      zone_id: zone_id ? String(zone_id).trim() : null,
      created_at: new Date().toISOString(),
    });

    return AcWebResponse.json({
      data: {
        success: true,
        message: 'User created successfully',
        userId,
      },
      responseCode: 201,
    });
  }

  @AcWebRoute({ path: '/:id', method: 'put' })
  async updateUser(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request, [UserRole.SUPER_ADMIN, UserRole.ADMIN]);
    if ('responseCode' in authResult) return authResult as AcWebResponse;
    const caller = authResult.user;

    const id = parseInt(request.pathParameters?.id || request.get?.id || request.post?.id || '0', 10);
    if (!id) {
      return AcWebResponse.json({
        data: { success: false, error: 'Invalid user id' },
        responseCode: 400,
      });
    }

    const db = DbService.getInstance();
    const targetUser = await db.getUserById(id);
    if (!targetUser) {
      return AcWebResponse.json({
        data: { success: false, error: 'User not found' },
        responseCode: 404,
      });
    }

    if (caller.role === UserRole.ADMIN && targetUser.role === UserRole.SUPER_ADMIN) {
      return AcWebResponse.json({
        data: { success: false, error: 'Admins cannot modify Super Admin accounts' },
        responseCode: 403,
      });
    }

    const body = request.post || {};
    const updateData: any = {};

    if (body.username !== undefined) {
      if (typeof body.username !== 'string' || body.username.trim().length < 3) {
        return AcWebResponse.json({
          data: { success: false, error: 'Username must be at least 3 characters long' },
          responseCode: 400,
        });
      }
      const trimmedUsername = body.username.trim();
      if (trimmedUsername.toLowerCase() !== targetUser.username.toLowerCase()) {
        const existing = await db.getUserByUsername(trimmedUsername);
        if (existing && existing.id !== id) {
          return AcWebResponse.json({
            data: { success: false, error: 'Username already exists' },
            responseCode: 409,
          });
        }
      }
      updateData.username = trimmedUsername;
    }

    if (body.role !== undefined) {
      const validRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.REGULAR_USER];
      if (!validRoles.includes(body.role)) {
        return AcWebResponse.json({
          data: { success: false, error: 'Invalid user role' },
          responseCode: 400,
        });
      }
      if (caller.role === UserRole.ADMIN && body.role === UserRole.SUPER_ADMIN) {
        return AcWebResponse.json({
          data: { success: false, error: 'Admins cannot promote users to Super Admin' },
          responseCode: 403,
        });
      }
      updateData.role = body.role;
    }

    if (body.zone_id !== undefined) updateData.zone_id = body.zone_id ? String(body.zone_id).trim() : null;

    if (body.password !== undefined) {
      if (typeof body.password !== 'string' || body.password.trim().length < 4) {
        return AcWebResponse.json({
          data: { success: false, error: 'Password must be at least 4 characters long' },
          responseCode: 400,
        });
      }
      updateData.password_hash = await bcrypt.hash(body.password.trim(), 10);
    }

    const success = await db.updateUser(id, updateData);

    return AcWebResponse.json({
      data: {
        success,
        message: success ? 'User updated successfully' : 'Failed to update user',
      },
    });
  }

  @AcWebRoute({ path: '/:id/password', method: 'post' })
  @AcWebRoute({ path: '/:id/password', method: 'put' })
  async updatePassword(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request, [UserRole.SUPER_ADMIN, UserRole.ADMIN]);
    if ('responseCode' in authResult) return authResult as AcWebResponse;
    const caller = authResult.user;

    const id = parseInt(request.pathParameters?.id || request.get?.id || request.post?.id || '0', 10);
    if (!id) {
      return AcWebResponse.json({
        data: { success: false, error: 'Invalid user id' },
        responseCode: 400,
      });
    }

    const db = DbService.getInstance();
    const targetUser = await db.getUserById(id);
    if (!targetUser) {
      return AcWebResponse.json({
        data: { success: false, error: 'User not found' },
        responseCode: 404,
      });
    }

    if (caller.role === UserRole.ADMIN && targetUser.role === UserRole.SUPER_ADMIN) {
      return AcWebResponse.json({
        data: { success: false, error: 'Admins cannot modify Super Admin passwords' },
        responseCode: 403,
      });
    }

    const body = request.post || {};
    const password = body.password || body.newPassword;
    if (!password || typeof password !== 'string' || password.trim().length < 4) {
      return AcWebResponse.json({
        data: { success: false, error: 'Password must be at least 4 characters long' },
        responseCode: 400,
      });
    }

    const passwordHash = await bcrypt.hash(password.trim(), 10);
    const success = await db.updateUser(id, { password_hash: passwordHash });

    return AcWebResponse.json({
      data: {
        success,
        message: success ? 'Password updated successfully' : 'Failed to update password',
      },
    });
  }

  @AcWebRoute({ path: '/:id', method: 'delete' })
  async deleteUser(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request, [UserRole.SUPER_ADMIN]);
    if ('responseCode' in authResult) return authResult as AcWebResponse;

    const id = parseInt(request.pathParameters?.id || request.get?.id || '0', 10);
    if (!id) {
      return AcWebResponse.json({
        data: { success: false, error: 'Invalid user id' },
        responseCode: 400,
      });
    }

    const db = DbService.getInstance();
    const success = await db.deleteUser(id);

    return AcWebResponse.json({
      data: {
        success,
        message: success ? 'User deleted successfully' : 'Failed to delete user',
      },
    });
  }
}
