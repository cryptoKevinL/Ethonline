fetch('/pay_action.php?id=3973&py=339', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'https://constructtest.abrigo.com'
  },
  body: 'frmPayHistoryID=339&frmProjectID=3973&frmPaymentStatus=P&phAmount_textmax=&frmPayAction=FA&frmActionNotes=fromDaWeb'
});
