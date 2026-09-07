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
    const authResult = requireAuth(request, [UserRole.SUPER_ADMIN]);
    if ('responseCode' in authResult) return authResult as AcWebResponse;

    const id = parseInt(request.pathParameters?.id || request.get?.id || '0', 10);
    if (!id) {
      return AcWebResponse.json({
        data: { success: false, error: 'Invalid user id' },
        responseCode: 400,
      });
    }

    const body = request.post || {};
    const updateData: any = {};
    if (body.role) updateData.role = body.role;
    if (body.zone_id !== undefined) updateData.zone_id = body.zone_id ? String(body.zone_id).trim() : null;
    if (body.password) {
      updateData.password_hash = await bcrypt.hash(body.password, 10);
    }

    const db = DbService.getInstance();
    const success = await db.updateUser(id, updateData);

    return AcWebResponse.json({
      data: {
        success,
        message: success ? 'User updated successfully' : 'Failed to update user',
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
