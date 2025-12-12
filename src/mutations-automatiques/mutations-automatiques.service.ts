import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Demande, DemandeDocument } from '../demandes/schemas/demande.schema';
import { DemandeStatus } from '../common/enums/demande-status.enum';
import { PostesService } from '../postes/postes.service';
import { AgentsService } from '../agents/agents.service';

@Injectable()
export class MutationsAutomatiquesService {
  private readonly logger = new Logger(MutationsAutomatiquesService.name);

  constructor(
    @InjectModel(Demande.name) private demandeModel: Model<DemandeDocument>,
    private postesService: PostesService,
    private agentsService: AgentsService,
  ) {}

  /**
   * Tâche cron qui s'exécute tous les jours à minuit pour appliquer les mutations
   * dont la date de mutation est atteinte
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async appliquerMutationsAutomatiques() {
    this.logger.log('Début de la vérification des mutations à appliquer automatiquement');

    try {
      const maintenant = new Date();
      maintenant.setHours(23, 59, 59, 999); // Fin de la journée d'aujourd'hui

      // Récupérer toutes les demandes acceptées avec une dateMutation qui est aujourd'hui ou passée
      // et qui n'ont pas encore été appliquées (on vérifie si le poste n'est pas déjà affecté à cet agent)
      const demandesAAppliquer = await this.demandeModel
        .find({
          statut: DemandeStatus.ACCEPTEE,
          dateMutation: { $exists: true, $ne: null, $lte: maintenant },
          posteSouhaiteId: { $exists: true, $ne: null },
        })
        .populate('agentId posteSouhaiteId')
        .exec();

      this.logger.log(`${demandesAAppliquer.length} demande(s) trouvée(s) à appliquer`);

      let mutationsAppliquees = 0;
      let erreurs = 0;

      for (const demande of demandesAAppliquer) {
        const demandeDoc = demande as DemandeDocument;
        try {
          // Vérifier que la demande a un agent et un poste
          if (!demandeDoc.agentId || !demandeDoc.posteSouhaiteId) {
            this.logger.warn(
              `Demande ${demandeDoc._id}: agentId ou posteSouhaiteId manquant, ignorée`
            );
            continue;
          }

          // Récupérer l'ID de l'agent (peut être un ObjectId ou un objet populé)
          let agentId: string;
          if (typeof demandeDoc.agentId === 'object' && demandeDoc.agentId !== null) {
            agentId = (demandeDoc.agentId as any)._id?.toString() || (demandeDoc.agentId as any).toString();
          } else {
            agentId = demandeDoc.agentId.toString();
          }

          // Récupérer l'ID du poste (peut être un ObjectId ou un objet populé)
          let posteId: string;
          if (typeof demandeDoc.posteSouhaiteId === 'object' && demandeDoc.posteSouhaiteId !== null) {
            posteId = (demandeDoc.posteSouhaiteId as any)._id?.toString() || (demandeDoc.posteSouhaiteId as any).toString();
          } else {
            posteId = demandeDoc.posteSouhaiteId.toString();
          }

          // Vérifier si l'agent est déjà affecté à ce poste
          const agent = await this.agentsService.findOne(agentId);
          if (agent && agent.affectationsPostes) {
            const estDejaAffecte = agent.affectationsPostes.some((aff) => {
              const affectationPosteId = typeof aff.posteId === 'object' && aff.posteId !== null
                ? (aff.posteId as any)._id?.toString() || (aff.posteId as any).toString()
                : aff.posteId?.toString();
              return affectationPosteId === posteId && !aff.dateFin;
            });

            if (estDejaAffecte) {
              this.logger.log(
                `Demande ${demandeDoc._id}: L'agent ${agentId} est déjà affecté au poste ${posteId}, mutation ignorée`
              );
              continue;
            }
          }

          // Appliquer la mutation en affectant le poste à l'agent
          // La méthode affecterAgent gère automatiquement le remplacement de l'agent précédent si le poste est occupé
          await this.postesService.affecterAgent(posteId, agentId);

          this.logger.log(
            `Mutation appliquée avec succès: Agent ${agentId} affecté au poste ${posteId} (Demande ${demandeDoc._id})`
          );
          mutationsAppliquees++;

        } catch (error) {
          this.logger.error(
            `Erreur lors de l'application de la mutation pour la demande ${demandeDoc._id}: ${error.message}`,
            error.stack
          );
          erreurs++;
        }
      }

      this.logger.log(
        `Vérification terminée: ${mutationsAppliquees} mutation(s) appliquée(s), ${erreurs} erreur(s)`
      );

    } catch (error) {
      this.logger.error(
        `Erreur lors de la vérification des mutations automatiques: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Méthode pour appliquer manuellement une mutation (utile pour les tests ou l'application immédiate)
   */
  async appliquerMutationManuelle(demandeId: string): Promise<void> {
    const demande = await this.demandeModel.findById(demandeId)
      .populate('agentId posteSouhaiteId')
      .exec();

    if (!demande) {
      throw new Error(`Demande ${demandeId} non trouvée`);
    }

    const demandeDoc = demande as DemandeDocument;

    if (demandeDoc.statut !== DemandeStatus.ACCEPTEE) {
      throw new Error(`La demande ${demandeId} n'est pas acceptée`);
    }

    if (!demandeDoc.agentId || !demandeDoc.posteSouhaiteId) {
      throw new Error(`La demande ${demandeId} n'a pas d'agent ou de poste spécifié`);
    }

    // Récupérer l'ID de l'agent
    let agentId: string;
    if (typeof demandeDoc.agentId === 'object' && demandeDoc.agentId !== null) {
      agentId = (demandeDoc.agentId as any)._id?.toString() || (demandeDoc.agentId as any).toString();
    } else {
      agentId = demandeDoc.agentId.toString();
    }

    // Récupérer l'ID du poste
    let posteId: string;
    if (typeof demandeDoc.posteSouhaiteId === 'object' && demandeDoc.posteSouhaiteId !== null) {
      posteId = (demandeDoc.posteSouhaiteId as any)._id?.toString() || (demandeDoc.posteSouhaiteId as any).toString();
    } else {
      posteId = demandeDoc.posteSouhaiteId.toString();
    }

    // Appliquer la mutation
    await this.postesService.affecterAgent(posteId, agentId);

    this.logger.log(
      `Mutation manuelle appliquée: Agent ${agentId} affecté au poste ${posteId} (Demande ${demandeId})`
    );
  }
}

