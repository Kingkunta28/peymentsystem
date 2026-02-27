from django.contrib.auth.models import Group, User
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Invoice, Payment


class InvoiceSerializer(serializers.ModelSerializer):
    customer_uid = serializers.CharField(source='customer.profile.uid', read_only=True)
    customer_username = serializers.CharField(source='customer.username', read_only=True)
    total_paid = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Invoice
        fields = [
            'id',
            'customer',
            'customer_uid',
            'customer_username',
            'control_number',
            'amount',
            'due_date',
            'status',
            'total_paid',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['status', 'total_paid', 'created_at', 'updated_at']

    def validate_customer(self, value):
        if value is None:
            raise serializers.ValidationError('Customer (user) is required.')
        if value.is_staff or value.is_superuser:
            raise serializers.ValidationError('Customer must be a non-staff user with UID.')
        return value


class PaymentSerializer(serializers.ModelSerializer):
    invoice_status = serializers.CharField(source='invoice.status', read_only=True)
    customer_uid = serializers.CharField(source='invoice.customer.profile.uid', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id',
            'invoice',
            'amount',
            'payment_date',
            'payment_method',
            'notes',
            'invoice_status',
            'customer_uid',
            'created_at',
        ]
        read_only_fields = ['invoice_status', 'created_at']


class CurrentUserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()
    uid = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'uid', 'username', 'email', 'is_staff', 'is_superuser', 'roles']

    def get_roles(self, obj):
        return list(obj.groups.values_list('name', flat=True))

    def get_uid(self, obj):
        profile = getattr(obj, 'profile', None)
        return getattr(profile, 'uid', None)


class RoleAwareTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['roles'] = list(user.groups.values_list('name', flat=True))
        token['username'] = user.username
        token['uid'] = getattr(getattr(user, 'profile', None), 'uid', None)
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = CurrentUserSerializer(self.user).data
        return data


class UserWithRolesSerializer(serializers.ModelSerializer):
    uid = serializers.SerializerMethodField(read_only=True)
    role_names = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
    )
    roles = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'uid', 'username', 'email', 'password', 'roles', 'role_names']
        extra_kwargs = {'password': {'write_only': True, 'min_length': 6}}

    def get_roles(self, obj):
        return list(obj.groups.values_list('name', flat=True))

    def get_uid(self, obj):
        profile = getattr(obj, 'profile', None)
        return getattr(profile, 'uid', None)

    def create(self, validated_data):
        role_names = validated_data.pop('role_names', [])
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        self._set_groups(user, role_names)
        return user

    def update(self, instance, validated_data):
        role_names = validated_data.pop('role_names', None)
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        if role_names is not None:
            self._set_groups(instance, role_names)
        return instance

    def _set_groups(self, user, role_names):
        groups = Group.objects.filter(name__in=role_names)
        user.groups.set(groups)
        user.is_staff = user.is_superuser or ('admin' in role_names) or ('manager' in role_names)
        user.save(update_fields=['is_staff'])


class UserDirectorySerializer(serializers.ModelSerializer):
    uid = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'uid', 'username']

    def get_uid(self, obj):
        profile = getattr(obj, 'profile', None)
        return getattr(profile, 'uid', None)


class ControlNumberInvoiceSerializer(serializers.ModelSerializer):
    customer_uid = serializers.CharField(source='customer.profile.uid', read_only=True)
    customer_username = serializers.CharField(source='customer.username', read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id',
            'control_number',
            'customer_uid',
            'customer_username',
            'amount',
            'due_date',
            'status',
        ]


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(min_length=6, write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username already exists.')
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            is_staff=False,
            is_superuser=False,
        )
        user.groups.clear()
        return user


class CashierRegistrationSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(min_length=6, write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username already exists.')
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            is_staff=False,
            is_superuser=False,
        )
        cashier_group, _ = Group.objects.get_or_create(name='cashier')
        user.groups.set([cashier_group])
        return user
