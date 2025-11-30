import { Controller, Post, Body, Get, UseGuards, Request, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';
import { PasswordResetService } from './password-reset.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private auditService: AuditService,
    private passwordResetService: PasswordResetService,
  ) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const ip = this.getClientIp(req);
    const userAgent = req.headers['user-agent'];
    
    try {
      const result = await this.authService.login(loginDto);
      
      // Logger la connexion réussie
      await this.auditService.log(
        'LOGIN',
        'AUTH',
        result.user?.id,
        { success: true, email: loginDto.email },
        ip,
        userAgent,
        {
          userEmail: result.user?.email,
          userRole: result.user?.role,
          method: 'POST',
          url: '/auth/login',
          statusCode: 200,
        },
      );
      
      return result;
    } catch (error) {
      // Logger la tentative de connexion échouée
      await this.auditService.log(
        'LOGIN_ERROR',
        'AUTH',
        undefined,
        { success: false, email: loginDto.email, error: error.message },
        ip,
        userAgent,
        {
          method: 'POST',
          url: '/auth/login',
          statusCode: error.status || 401,
          error: error.message,
        },
      );
      
      throw error;
    }
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Req() req: Request) {
    const ip = this.getClientIp(req);
    const userAgent = req.headers['user-agent'];
    
    try {
      // Auto-inscription : createdByAdmin = false
      const result = await this.authService.register(registerDto, false);
      
      // Logger l'inscription réussie
      await this.auditService.log(
        'REGISTER',
        'AUTH',
        result.user?.id,
        { success: true, email: registerDto.email, role: registerDto.role },
        ip,
        userAgent,
        {
          userEmail: result.user?.email,
          userRole: result.user?.role,
          method: 'POST',
          url: '/auth/register',
          statusCode: 201,
        },
      );
      
      return result;
    } catch (error) {
      // Logger l'inscription échouée
      await this.auditService.log(
        'REGISTER_ERROR',
        'AUTH',
        undefined,
        { success: false, email: registerDto.email, error: error.message },
        ip,
        userAgent,
        {
          method: 'POST',
          url: '/auth/register',
          statusCode: error.status || 400,
          error: error.message,
        },
      );
      
      throw error;
    }
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = forwarded.toString().split(',');
      return ips[0].trim();
    }
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return realIp.toString();
    }
    const reqAny = req as any;
    return reqAny.ip || reqAny.connection?.remoteAddress || reqAny.socket?.remoteAddress || 'unknown';
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return req.user;
  }

  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    try {
      await this.passwordResetService.requestResetCode(forgotPasswordDto.email);
      // Toujours retourner un succès pour ne pas révéler si l'email existe
      return {
        message: 'Si cet email existe dans notre système, un code de réinitialisation vous a été envoyé.',
      };
    } catch (error) {
      // Logger l'erreur mais retourner un message générique
      return {
        message: 'Si cet email existe dans notre système, un code de réinitialisation vous a été envoyé.',
      };
    }
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.passwordResetService.resetPassword(
      resetPasswordDto.email,
      resetPasswordDto.code,
      resetPasswordDto.newPassword,
    );
    return {
      message: 'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.',
    };
  }
}

