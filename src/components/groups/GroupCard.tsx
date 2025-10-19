import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, DollarSign, Calendar, Edit, Send, Loader2, CheckCircle, XCircle } from "lucide-react";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  payment_amount: number;
  payment_frequency: string;
  chain: string;
  token: string;
  status: string;
  role: string;
  wallet_address: string;
  employment_id?: string;
}

interface Group {
  id: string;
  name: string;
  employees: number;
  totalPayment: string;
  totalPaymentUSDC: number;
  nextPayment: string;
  status: string;
  created_at?: string;
  employer?: {
    id: string;
    name: string;
    email: string;
  };
  employeeDetails?: Employee[];
}

interface GroupCardProps {
  group: Group;
  index: number;
  isProcessingPayment: string | null;
  formatTotalPayment: (group: Group) => string;
  onEdit: (groupId: string) => void;
  onPayAll: (group: Group) => void;
}

export function GroupCard({ 
  group, 
  index, 
  isProcessingPayment, 
  formatTotalPayment, 
  onEdit, 
  onPayAll 
}: GroupCardProps) {
  const validEmployees = group.employeeDetails?.filter(emp => 
    emp.wallet_address && 
    emp.wallet_address.trim() !== '' && 
    emp.payment_amount && 
    emp.payment_amount > 0
  ) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="glass-card p-6 hover-lift h-full">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="p-3 bg-gradient-to-r from-primary to-blue-500 rounded-xl">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <Badge className="bg-green-500/20 text-green-700 hover:bg-green-500/30">
              {group.status}
            </Badge>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-2">{group.name}</h3>
            {group.employer && (
              <p className="text-sm text-muted-foreground">
                {group.employer.email}
              </p>
            )}
          </div>

          <div className="space-y-3 pt-2 border-t border-white/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Users className="h-4 w-4" />
                Employees
              </div>
              <div className="font-semibold">{group.employees}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <DollarSign className="h-4 w-4" />
                Total Payment
              </div>
              <div className="font-bold gradient-text">
                {formatTotalPayment(group)}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Calendar className="h-4 w-4" />
                Next Payment
              </div>
              <div className="text-sm font-medium">{group.nextPayment}</div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1 glass-card border-white/20"
              onClick={() => onEdit(group.id)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Group
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-primary to-cyan-500 hover:opacity-90"
              onClick={() => onPayAll(group)}
              disabled={
                isProcessingPayment === group.id || 
                validEmployees.length === 0
              }
            >
              {isProcessingPayment === group.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Pay All
                </>
              )}
            </Button>
          </div>

          {group.employeeDetails && group.employeeDetails.length > 0 && (
            <div className="pt-4 border-t border-white/20">
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Employees</h4>
              <div className="space-y-2">
                {group.employeeDetails.slice(0, 3).map((employee, empIndex) => (
                  <div key={empIndex} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>{employee.first_name} {employee.last_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {parseFloat(employee.payment_amount?.toString() || '0').toFixed(2)} {employee.token?.toUpperCase()}
                      </span>
                      {employee.wallet_address ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
                {group.employeeDetails.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center pt-1">
                    +{group.employeeDetails.length - 3} more employees
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}