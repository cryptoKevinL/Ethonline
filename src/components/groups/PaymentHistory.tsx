import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, RefreshCw, Loader2 } from "lucide-react";

interface Payment {
  id: string;
  amount_token: string;
  token: string;
  status: string;
  chain: string;
  recipient: string;
  tx_hash?: string;
  pay_date: string;
  employments?: {
    role: string;
    employees?: {
      first_name: string;
      last_name: string;
    };
  };
}

interface PaymentHistoryProps {
  payments: Payment[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function PaymentHistory({ payments, isLoading, onRefresh }: PaymentHistoryProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold gradient-text">Database Payment History</h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </>
          )}
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading database payments...</span>
        </div>
      ) : payments.length === 0 ? (
        <Card className="glass-card p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-muted/50 rounded-full">
              <Receipt className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">No Database Payments Yet</h3>
              <p className="text-muted-foreground">
                Payments will appear here once they are processed and saved to the database.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {payments.map((payment) => (
            <Card key={payment.id} className="glass-card p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Receipt className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-lg">Database Payment</p>
                      <p className="text-sm text-muted-foreground">
                        {payment.employments?.employees?.first_name} {payment.employments?.employees?.last_name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {payment.amount_token} {payment.token?.toUpperCase()}
                    </p>
                    <Badge variant="outline" className="mt-1">
                      {payment.status}
                    </Badge>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-white/20">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Employee:</span>
                      <span>{payment.employments?.employees?.first_name} {payment.employments?.employees?.last_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Role:</span>
                      <span>{payment.employments?.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recipient:</span>
                      <span className="font-mono text-xs">{payment.recipient?.slice(0, 6)}...{payment.recipient?.slice(-4)}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Chain:</span>
                      <span>{payment.chain}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pay Date:</span>
                      <span>{new Date(payment.pay_date).toLocaleDateString()}</span>
                    </div>
                    {payment.tx_hash && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">TX Hash:</span>
                        <span className="font-mono text-xs">{payment.tx_hash.slice(0, 6)}...{payment.tx_hash.slice(-4)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}